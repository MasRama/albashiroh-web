/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { randomUUID } from 'node:crypto';
import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../../app/App.vue';
import router from '../../../../app/router';
import { app as serverApp } from '../../../../app/server';
import { getDatabase, seed } from '../../../../shared/database';
import { syncDeclaredPermissions } from '../../../auth';
import { csrfHeaders, issueCsrf } from '../../../../shared/security/tests/helpers';
import { csrfHeaders as browserCsrfHeaders, ensureCsrfToken, useAuthSession } from '../../../auth/web';
import { createTestAccount, grantAdmin, grantPermissions, revokeRoleFromEveryone, signIn, signUp } from '../../../../app/tests/personas';
import { createUsersClient } from '../../web';

const TEST_PASSWORD = 'correct horse battery staple';
const session = useAuthSession();
const browserCsrf = { headers: (extra?: HeadersInit) => browserCsrfHeaders(extra), ensureToken: () => ensureCsrfToken() };

let container: HTMLDivElement;
let application: { unmount(): void } | undefined;
let cookieJar: Map<string, string>;
let fetchRequests: Array<{ method: string; path: string }>;
let fetchUrls: string[];
let pendingFetches: Set<Promise<Response>>;

function syncDocumentCookies(): void {
  for (const [name, value] of cookieJar) document.cookie = `${name}=${value}; path=/`;
}

function adoptCookieString(cookieString: string): void {
  for (const part of cookieString.split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    cookieJar.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }
  syncDocumentCookies();
}

function setJar(cookieString: string): void {
  cookieJar = new Map();
  adoptCookieString(cookieString);
}

async function signOut(): Promise<void> {
  setJar('');
  document.cookie = 'auth_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  await session.refresh();
}

function storeResponseCookies(response: Response): void {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie') as string]
        : [];
  for (const header of setCookies) {
    const pair = (header.split(';', 1)[0] ?? '').trim();
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value.length === 0) cookieJar.delete(name);
    else cookieJar.set(name, value);
  }
  syncDocumentCookies();
}

function cookieHeader(): string | undefined {
  if (cookieJar.size === 0) return undefined;
  return [...cookieJar].map(([name, value]) => `${name}=${value}`).join('; ');
}

function installApiFetch(): void {
  const request = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(inputUrl, 'http://nara.test');
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    fetchUrls.push(url.pathname + url.search);
    fetchRequests.push({ method, path: url.pathname });

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    for (const [name, value] of new Headers(init?.headers)) {
      headers.set(name, value);
    }
    const jar = cookieHeader();
    if (jar) headers.set('Cookie', jar);
    const outgoingRequest = new Request(url.href, { method, headers, body: init?.body });
    const requestBody = ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : await outgoingRequest.arrayBuffer();
    const response = await serverApp.request(url.pathname + url.search, {
      method: outgoingRequest.method,
      headers: outgoingRequest.headers,
      body: requestBody,
    });
    storeResponseCookies(response);
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      json: async () => JSON.parse(body),
      text: async () => body,
    } as Response;
  };

  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = request(input, init);
    pendingFetches.add(response);
    void response.finally(() => pendingFetches.delete(response));
    return response;
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

// Registration is closed: the account is made the way the owner makes one, then signs in.
async function registerDirect(email: string, name = 'Existing User'): Promise<string> {
  await createTestAccount(name, email, TEST_PASSWORD);
  const cookie = await signIn(email, TEST_PASSWORD);
  if (!cookie.includes('auth_id=')) throw new Error('Sign-in did not return a session cookie');
  return cookie;
}

function userIdForEmail(email: string): string {
  const row = getDatabase().prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (!row) throw new Error(`Missing test user ${email}`);
  return row.id;
}

async function startAuthenticatedAdmin(email = `${randomUUID()}@example.com`): Promise<void> {
  adoptCookieString(await registerDirect(email, 'Browser Administrator'));
  grantAdmin(userIdForEmail(email));
  await session.refresh();
}

async function startAuthenticatedManager(email = `${randomUUID()}@example.com`): Promise<void> {
  adoptCookieString(await registerDirect(email, 'Browser Manager'));
  grantPermissions(userIdForEmail(email), ['users.view', 'users.edit']);
  await session.refresh();
}

async function startAuthenticatedUser(email = `${randomUUID()}@example.com`): Promise<void> {
  adoptCookieString(await registerDirect(email));
  await session.refresh();
}

async function settle(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (pendingFetches.size > 0) {
      await Promise.all([...pendingFetches]);
    }
    await Promise.resolve();
    await nextTick();
  }
}

function waitForNavigation(): Promise<void> {
  return new Promise((resolveNavigation) => {
    const removeHook = router.afterEach(() => {
      removeHook();
      resolveNavigation();
    });
  });
}

async function mountAt(path: string): Promise<void> {
  await router.push(path);
  await router.isReady();
  const mountedApplication = createApp(App).use(router);
  mountedApplication.mount(container);
  application = mountedApplication;
  await nextTick();
}

// The admin screens: labelled fields, dialogs teleported to the body, a row per account.
function dialog(title: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('.ab-dialog')].find(
    (item) => item.querySelector('.ab-dialog-title')?.textContent?.trim() === title,
  );
  if (!found) throw new Error(`Missing dialog ${title}`);
  return found;
}

function field(label: string, scope: ParentNode = document): HTMLInputElement {
  const wrap = [...scope.querySelectorAll('.ab-field')].find(
    (item) => item.querySelector('label')?.textContent?.replace('*', '').trim() === label,
  );
  const input = wrap?.querySelector('input');
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing field ${label}`);
  return input;
}

function setField(label: string, value: string, scope: ParentNode = document): void {
  const input = field(label, scope);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function buttonWithText(text: string, scope: ParentNode = document): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === text);
}

async function clickText(text: string, scope: ParentNode = document): Promise<void> {
  const button = buttonWithText(text, scope);
  if (!button) throw new Error(`Missing button ${text}`);
  button.click();
  await settle();
}

async function toggle(title: string, label: string): Promise<void> {
  const target = dialog(title).querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${label}"]`);
  if (!target) throw new Error(`Missing switch ${label}`);
  target.click();
  await nextTick();
}

function userRow(text: string): HTMLElement {
  const row = [...container.querySelectorAll<HTMLElement>('[data-user-id]')].find((item) => item.textContent?.includes(text));
  if (!row) throw new Error(`Missing user row containing ${text}`);
  return row;
}

async function search(term: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('input[type="search"]');
  if (!input) throw new Error('Missing search field');
  input.value = term;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  // The list waits for typing to pause before it asks the server.
  await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  await settle();
}

const requestsTo = (method: string, path: string) => fetchRequests.filter((item) => item.method === method && item.path === path).length;
const password = (id: string) => (getDatabase().prepare('SELECT password FROM users WHERE id = ?').get(id) as { password: string }).password;

beforeEach(async () => {
  container = document.createElement('div');
  document.body.append(container);
  application = undefined;
  cookieJar = new Map();
  document.cookie = 'auth_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  fetchRequests = [];
  fetchUrls = [];
  pendingFetches = new Set();
  seed();
  // Startup order: roles exist, then declared permissions are written and granted to admin.
  syncDeclaredPermissions();
  installApiFetch();

  await signOut();
  await router.push('/');
  await router.isReady();
});

afterEach(async () => {
  application?.unmount();
  application = undefined;
  await signOut();
  await router.push('/');
  container.remove();
  vi.unstubAllGlobals();
});

describe('users browser surfaces', () => {
  it('redirects guests from protected account routes', async () => {
    await mountAt('/admin/profil');

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/admin/profil');
  });

  it('renders the admin shell and opens Profil from it without a reload', async () => {
    await startAuthenticatedUser();
    await mountAt('/admin');
    await settle();
    const documentElement = document.documentElement;

    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(container.querySelector('[data-testid="admin-shell"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Navigasi admin"]')).not.toBeNull();

    const navigation = waitForNavigation();
    container.querySelector<HTMLAnchorElement>('a[href="/admin/profil"]')?.click();
    await navigation;
    await settle();

    expect(router.currentRoute.value.name).toBe('profile');
    expect(container.querySelector('h1')?.textContent).toContain('Profil');
    expect(document.documentElement).toBe(documentElement);
  });

  it('loads and saves the current profile through the Users routes', async () => {
    const email = `${randomUUID()}@example.com`;
    await startAuthenticatedUser(email);
    await mountAt('/admin/profil');
    await settle();

    expect(field('Nama').value).toBe('Existing User');
    expect(field('Email').value).toBe(email);

    const updatedEmail = `${randomUUID()}@example.com`;
    setField('Nama', 'Updated User');
    setField('Email', updatedEmail);
    await nextTick();
    await clickText('Simpan perubahan');

    expect(container.textContent).toContain('Profil disimpan');
    expect(session.user.value).toMatchObject({ name: 'Updated User', email: updatedEmail });
    expect(fetchRequests).toContainEqual({ method: 'PATCH', path: '/api/users/me' });

    const response = await serverApp.request('/api/users/me', { headers: { Cookie: cookieHeader()! } });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { user: { name: 'Updated User', email: updatedEmail } },
    });
  });

  it('shows profile validation errors without sending invalid input', async () => {
    await startAuthenticatedUser();
    await mountAt('/admin/profil');
    await settle();
    const before = requestsTo('PATCH', '/api/users/me');

    setField('Nama', ' ');
    setField('Email', 'invalid');
    await nextTick();
    await clickText('Simpan perubahan');

    expect(container.textContent).toContain('Isi nama.');
    expect(container.textContent).toContain('Isi email yang benar.');
    expect(requestsTo('PATCH', '/api/users/me')).toBe(before);
  });

  it('merges a profile save made on another device instead of overwriting it', async () => {
    const email = `${randomUUID()}@example.com`;
    await startAuthenticatedUser(email);
    await mountAt('/admin/profil');
    await settle();

    setField('Nama', 'Mine');
    // The same account saves a new email from another device first.
    const otherDevice = await signIn(email, TEST_PASSWORD);
    const otherCsrf = await issueCsrf(serverApp, otherDevice);
    const theirEmail = `${randomUUID()}@example.com`;
    const theirSave = await serverApp.request('/api/users/me', {
      method: 'PATCH',
      headers: { ...csrfHeaders(otherCsrf), 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: 1, name: 'Existing User', email: theirEmail }),
    });
    expect(theirSave.status).toBe(200);

    await nextTick();
    await clickText('Simpan perubahan');

    expect(field('Nama').value).toBe('Mine');
    expect(field('Email').value).toBe(theirEmail);
    const id = userIdForEmail(theirEmail);

    await clickText('Simpan perubahan');
    expect(getDatabase().prepare('SELECT name, email, revision FROM users WHERE id = ?').get(id)).toEqual({
      name: 'Mine',
      email: theirEmail,
      revision: 3,
    });
  });

  it('changes the password, keeps the session, and reports a wrong current password', async () => {
    await startAuthenticatedUser();
    await mountAt('/admin/kata-sandi');
    await settle();

    setField('Kata sandi sekarang', 'wrong password');
    setField('Kata sandi baru', 'new correct horse battery staple');
    setField('Ulangi kata sandi baru', 'new correct horse battery staple');
    await nextTick();
    await clickText('Simpan kata sandi');

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Kata sandi yang sekarang salah.');
    expect(router.currentRoute.value.name).toBe('change-password');

    setField('Kata sandi sekarang', TEST_PASSWORD);
    await nextTick();
    const navigation = waitForNavigation();
    await clickText('Simpan kata sandi');
    await navigation;

    expect(router.currentRoute.value.name).toBe('profile');
    expect(session.user.value).not.toBeNull();
    expect(fetchRequests).toContainEqual({ method: 'POST', path: '/api/auth/change-password' });
  });

  it('keeps the public home free of admin calls, signed in or not', async () => {
    // This application's public site is the school's, for visitors: staff reach the panel at /admin.
    await mountAt('/');
    expect(container.querySelector('a[href="/admin/masuk"]')).toBeNull();
    expect(container.querySelector('a[href="/admin"]')).toBeNull();

    await startAuthenticatedUser();
    await router.push('/');
    await router.isReady();
    await nextTick();

    expect(container.querySelector('a[href="/admin"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/masuk"]')).toBeNull();
  });

  it('signs out from the shell and protects account routes again', async () => {
    await startAuthenticatedUser();
    await mountAt('/admin');
    await settle();

    const navigation = waitForNavigation();
    buttonWithText('Keluar', container)?.click();
    await navigation;

    expect(router.currentRoute.value.name).toBe('login');
    expect(session.user.value).toBeNull();
    await router.push('/admin/profil');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/admin/profil');
  });
});

describe('users administration browser surfaces', () => {
  it('lists the account screens in the sidebar for an administrator', async () => {
    await startAuthenticatedAdmin();
    await mountAt('/admin');
    await settle();
    const sessionResponse = await serverApp.request('/api/auth/me', { headers: { Cookie: cookieHeader()! } });
    await expect(sessionResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        user: {
          roles: expect.arrayContaining(['admin']),
          permissions: expect.arrayContaining(['users.view', 'roles.view']),
        },
      },
    });

    const sidebar = container.querySelector('[aria-label="Navigasi admin"]')!;
    expect(sidebar.querySelector('a[href="/admin/pengguna"]')?.textContent).toContain('Pengguna');
    expect(sidebar.querySelector('a[href="/admin/peran"]')?.textContent).toContain('Peran & izin');
    expect(sidebar.querySelector('a[href="/admin/aktivitas"]')?.textContent).toContain('Aktivitas');
  });

  it('redirects restricted users away from administration routes', async () => {
    await startAuthenticatedUser();
    await mountAt('/admin');
    await settle();

    expect(container.querySelector('a[href="/admin/pengguna"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/peran"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/profil"]')).not.toBeNull();

    await router.push('/admin/pengguna');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(container.querySelector('[data-testid="users-page"]')).toBeNull();

    await router.push('/admin/peran');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(container.querySelector('[data-testid="roles-page"]')).toBeNull();
  });

  it('says so when the roles cannot load instead of creating an account without one', async () => {
    await startAuthenticatedAdmin();
    const delegatedFetch = globalThis.fetch;
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(inputUrl, 'http://nara.test');
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      if (method.toUpperCase() === 'GET' && url.pathname === '/api/roles') {
        return Promise.resolve(
          new Response(JSON.stringify({ success: false, message: 'Role directory unavailable', code: 'INTERNAL_ERROR' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return delegatedFetch(input, init);
    });

    await mountAt('/admin/pengguna');
    await settle();
    await clickText('Pengguna baru', container);

    expect(dialog('Pengguna baru').textContent).toContain('Daftar peran belum bisa dimuat');
    expect(dialog('Pengguna baru').querySelector('[role="switch"]')).toBeNull();
    const before = requestsTo('POST', '/api/users');
    setField('Nama', 'No Role Yet', dialog('Pengguna baru'));
    setField('Email', `${randomUUID()}@example.com`, dialog('Pengguna baru'));
    await nextTick();
    await clickText('Buat akun', dialog('Pengguna baru'));
    expect(requestsTo('POST', '/api/users')).toBe(before);
  });

  it('searches the users list on the server', async () => {
    const searchTerm = `Searchable-${randomUUID()}`;
    await startAuthenticatedAdmin();
    await registerDirect(`${randomUUID()}@example.com`, `${searchTerm} One`);
    await registerDirect(`${randomUUID()}@example.com`, `${searchTerm} Two`);
    await registerDirect(`${randomUUID()}@example.com`, `${searchTerm} Three`);

    await mountAt('/admin/pengguna');
    await settle();
    await search(searchTerm);

    expect(fetchUrls.some((url) => url.startsWith('/api/users?') && url.includes(`search=${encodeURIComponent(searchTerm)}`))).toBe(true);
    const page = container.querySelector('[data-testid="users-page"]')?.textContent;
    expect(page).toContain(`${searchTerm} One`);
    expect(page).toContain(`${searchTerm} Two`);
    expect(page).toContain(`${searchTerm} Three`);
    expect(page).not.toContain('Browser Administrator');
  });

  it('keeps the newest users-list response when overlapping searches resolve out of order', async () => {
    const slowTerm = `Slow-${randomUUID()}`;
    const fastTerm = `Fast-${randomUUID()}`;
    await startAuthenticatedAdmin();
    await registerDirect(`${randomUUID()}@example.com`, `${slowTerm} Result`);
    await registerDirect(`${randomUUID()}@example.com`, `${fastTerm} Result`);
    await mountAt('/admin/pengguna');
    await settle();

    const delegatedFetch = globalThis.fetch;
    let releaseSlow: (() => void) | undefined;
    const slowGate = new Promise<void>((resolveGate) => {
      releaseSlow = resolveGate;
    });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(inputUrl, 'http://nara.test');
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      if (method.toUpperCase() === 'GET' && url.pathname === '/api/users' && url.searchParams.get('search') === slowTerm) {
        await slowGate;
      }
      return delegatedFetch(input, init);
    });

    const page = () => container.querySelector('[data-testid="users-page"]')?.textContent;
    void search(slowTerm);
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
    await search(fastTerm);
    expect(page()).toContain(`${fastTerm} Result`);
    expect(page()).not.toContain(`${slowTerm} Result`);

    releaseSlow?.();
    await settle();
    expect(page()).toContain(`${fastTerm} Result`);
    expect(page()).not.toContain(`${slowTerm} Result`);
  });

  it('requires a password before creating a managed user', async () => {
    const email = `${randomUUID()}@example.com`;
    await startAuthenticatedAdmin();
    await mountAt('/admin/pengguna');
    await settle();

    await clickText('Pengguna baru', container);
    const form = dialog('Pengguna baru');
    setField('Nama', 'Missing Browser Password', form);
    setField('Email', email, form);
    setField('Kata sandi sementara', '', form);
    await nextTick();
    const before = requestsTo('POST', '/api/users');
    await clickText('Buat akun', form);

    expect(form.textContent).toContain('Minimal 8 karakter.');
    expect(requestsTo('POST', '/api/users')).toBe(before);
    expect(getDatabase().prepare('SELECT id FROM users WHERE email = ?').get(email)).toBeUndefined();
  });

  it('creates users, validates input, assigns a role, resets a password, and refuses self-demotion', async () => {
    const email = `${randomUUID()}@example.com`;
    await startAuthenticatedAdmin();
    await mountAt('/admin/pengguna');
    await settle();

    await clickText('Pengguna baru', container);
    const form = dialog('Pengguna baru');
    setField('Nama', ' ', form);
    setField('Email', 'invalid', form);
    await nextTick();
    const before = requestsTo('POST', '/api/users');
    await clickText('Buat akun', form);
    expect(form.textContent).toContain('Isi nama.');
    expect(form.textContent).toContain('Isi email yang benar.');
    expect(requestsTo('POST', '/api/users')).toBe(before);

    setField('Nama', 'Created Browser User', form);
    setField('Email', email, form);
    setField('Kata sandi sementara', 'managed-password', form);
    await nextTick();
    await clickText('Buat akun', form);

    expect(fetchRequests).toContainEqual({ method: 'POST', path: '/api/users' });
    expect(dialog('Akun dibuat').textContent).toContain('managed-password');
    expect(dialog('Akun dibuat').textContent).toContain(email);
    await clickText('Selesai', dialog('Akun dibuat'));
    const userId = userRow(email).dataset.userId!;
    // An account an administrator made changes its password at first sign-in.
    expect(getDatabase().prepare('SELECT must_change_password FROM users WHERE id = ?').get(userId)).toEqual({ must_change_password: 1 });

    const passwordBeforeEdit = password(userId);
    userRow(email).click();
    await settle();
    const edit = dialog('Created Browser User');
    setField('Nama', 'Updated Browser User', edit);
    await toggle('Created Browser User', 'Staf');
    await clickText('Simpan', edit);

    expect(userRow(email).textContent).toContain('Updated Browser User');
    expect(userRow(email).textContent).toContain('Staf');
    expect(container.textContent).toContain('Pengguna disimpan');
    expect(fetchRequests).toContainEqual({ method: 'PUT', path: `/api/users/${userId}` });
    expect(password(userId)).toBe(passwordBeforeEdit);

    userRow(email).click();
    await settle();
    await clickText('Atur ulang kata sandi', dialog('Updated Browser User'));
    setField('Kata sandi sementara', 'reset-managed-password', dialog('Atur ulang kata sandi'));
    await nextTick();
    await clickText('Atur ulang', dialog('Atur ulang kata sandi'));
    expect(fetchRequests).toContainEqual({ method: 'POST', path: `/api/users/${userId}/reset-password` });
    expect(password(userId)).not.toBe(passwordBeforeEdit);
    expect(dialog('Kata sandi diatur ulang').textContent).toContain('reset-managed-password');
    await clickText('Selesai', dialog('Kata sandi diatur ulang'));

    const response = await serverApp.request(`/api/users?search=${encodeURIComponent(email)}`, { headers: { Cookie: cookieHeader()! } });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { users: [{ email, roles: expect.arrayContaining(['user']) }] },
    });

    const selfId = userRow('Browser Administrator').dataset.userId!;
    const selfBefore = getDatabase().prepare('SELECT id, name, email, password FROM users WHERE id = ?').get(selfId);
    const selfRolesBefore = getDatabase().prepare('SELECT role_id FROM user_roles WHERE user_id = ? ORDER BY role_id').all(selfId);
    userRow('Browser Administrator').click();
    await settle();
    const self = dialog('Browser Administrator');
    // Nobody resets or removes their own account from here.
    expect(buttonWithText('Atur ulang kata sandi', self)).toBeUndefined();
    expect(buttonWithText('Hapus pengguna', self)).toBeUndefined();
    setField('Nama', 'Rejected Browser Administrator', self);
    await toggle('Browser Administrator', 'Administrator');
    await clickText('Simpan', self);

    expect(container.textContent).toContain('Anda tidak bisa mencabut peran administrator dari akun Anda sendiri.');
    expect(session.user.value).not.toBeNull();
    expect(getDatabase().prepare('SELECT id, name, email, password FROM users WHERE id = ?').get(selfId)).toEqual(selfBefore);
    expect(getDatabase().prepare('SELECT role_id FROM user_roles WHERE user_id = ? ORDER BY role_id').all(selfId)).toEqual(selfRolesBefore);
  });

  it('hides role controls for a manager and reports forbidden role assignment', async () => {
    await startAuthenticatedManager();
    const targetEmail = `${randomUUID()}@example.com`;
    await registerDirect(targetEmail, 'Manager Target');
    await mountAt('/admin/pengguna');
    await settle();

    expect(buttonWithText('Pengguna baru', container)).toBeUndefined();
    const targetId = userRow(targetEmail).dataset.userId!;
    userRow(targetEmail).click();
    await settle();
    expect(dialog('Manager Target').querySelector('[role="switch"]')).toBeNull();
    expect(dialog('Manager Target').textContent).toContain('Hanya administrator yang bisa mengubah peran.');

    const response = await createUsersClient({ csrf: browserCsrf }).updateUser(targetId, { revision: 1, roles: ['user'] });
    expect(response).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
      message: 'Forbidden',
    });
  });

  it('deletes allowed users and hides the self-delete action', async () => {
    await startAuthenticatedAdmin();
    const targetEmail = `${randomUUID()}@example.com`;
    await registerDirect(targetEmail, 'Delete Me');
    await mountAt('/admin/pengguna');
    await settle();

    const targetId = userRow(targetEmail).dataset.userId!;
    userRow(targetEmail).click();
    await settle();
    await clickText('Hapus pengguna', dialog('Delete Me'));
    await clickText('Hapus', dialog('Hapus Delete Me?'));
    expect(container.querySelector(`[data-user-id="${targetId}"]`)).toBeNull();
    expect(fetchRequests).toContainEqual({ method: 'DELETE', path: '/api/users' });
    expect(container.textContent).toContain('Delete Me dihapus');

    userRow('Browser Administrator').click();
    await settle();
    expect(buttonWithText('Hapus pengguna', dialog('Browser Administrator'))).toBeUndefined();
    expect(session.user.value).not.toBeNull();
  });

  it('merges a save made elsewhere when the server refuses an edit based on an older revision', async () => {
    const targetEmail = `${randomUUID()}@example.com`;
    await registerDirect(targetEmail, 'Shared Account');
    const targetId = userIdForEmail(targetEmail);
    await startAuthenticatedAdmin();
    await mountAt('/admin/pengguna');
    await settle();

    userRow(targetEmail).click();
    await settle();
    setField('Nama', 'Mine', dialog('Shared Account'));
    // Another administrator saves first, changing the name and the email.
    const theirEmail = `${randomUUID()}@example.com`;
    const colleague = await signUp('Other Administrator');
    grantAdmin(colleague.id);
    const colleagueCsrf = await issueCsrf(serverApp, colleague.cookie);
    const theirSave = await serverApp.request(`/api/users/${targetId}`, {
      method: 'PUT',
      headers: { ...csrfHeaders(colleagueCsrf), 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: 1, name: 'Theirs', email: theirEmail }),
    });
    expect(theirSave.status).toBe(200);

    await nextTick();
    await clickText('Simpan', dialog('Shared Account'));

    // What this administrator changed stays; what they left alone takes the other save.
    const merged = dialog('Theirs');
    expect(field('Nama', merged).value).toBe('Mine');
    expect(field('Email', merged).value).toBe(theirEmail);
    expect(getDatabase().prepare('SELECT name FROM users WHERE id = ?').get(targetId)).toEqual({ name: 'Theirs' });

    await clickText('Simpan', merged);

    expect(getDatabase().prepare('SELECT name, email, revision FROM users WHERE id = ?').get(targetId)).toEqual({
      name: 'Mine',
      email: theirEmail,
      revision: 3,
    });
    expect(userRow(theirEmail).textContent).toContain('Mine');
  });

  it('surfaces last-admin protection through the users browser client', async () => {
    revokeRoleFromEveryone('admin');

    const managerEmail = `${randomUUID()}@example.com`;
    const managerCookie = await registerDirect(managerEmail, 'Delete Manager');
    grantPermissions(userIdForEmail(managerEmail), ['users.view', 'users.delete']);

    const adminEmail = `${randomUUID()}@example.com`;
    await registerDirect(adminEmail, 'Sole Administrator');
    const adminId = userIdForEmail(adminEmail);
    grantAdmin(adminId);

    setJar(managerCookie);
    await session.refresh();
    const response = await createUsersClient({ csrf: browserCsrf }).deleteUsers({ ids: [adminId] });

    expect(response).toMatchObject({
      success: false,
      code: 'LAST_ADMIN',
      message: 'Cannot delete the last admin',
    });
  });
});
