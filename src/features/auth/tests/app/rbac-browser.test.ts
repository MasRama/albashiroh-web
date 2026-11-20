/// <reference lib="dom" />
import { randomUUID } from 'node:crypto';
import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../../app/App.vue';
import router from '../../../../app/router';
import { app as serverApp } from '../../../../app/server';
import { getDatabase, seed } from '../../../../shared/database';
import { syncDeclaredPermissions } from '../../server/permissions';
import { createTestAccount, signIn } from '../../../../app/tests/personas';
import { createAccessClient, useAuthSession } from '../../web';

const TEST_PASSWORD = 'correct horse battery staple';

let container: HTMLDivElement;
let application: { unmount(): void } | undefined;
let cookieJar: Map<string, string>;
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
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    for (const [name, value] of new Headers(init?.headers)) headers.set(name, value);
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
}

// Registration is closed: the account is made the way the owner makes one, then signs in.
async function registerDirect(email: string, name: string): Promise<string> {
  await createTestAccount(name, email, TEST_PASSWORD);
  const cookie = await signIn(email, TEST_PASSWORD);
  adoptCookieString(cookie);
  if (!cookie.includes('auth_id=')) throw new Error('Sign-in did not return a session cookie');
  return cookie;
}

function userIdForEmail(email: string): string {
  const row = getDatabase().prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (!row) throw new Error(`Missing test user ${email}`);
  return row.id;
}

function roleIdForSlug(slug: string): string {
  const row = getDatabase().prepare('SELECT id FROM roles WHERE slug = ?').get(slug) as { id: string } | undefined;
  if (!row) throw new Error(`Missing test role ${slug}`);
  return row.id;
}

function assignRole(userId: string, slug: string): void {
  getDatabase()
    .prepare('INSERT OR IGNORE INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, roleIdForSlug(slug), Date.now());
}

async function startAuthenticatedAdmin(): Promise<void> {
  const email = `${randomUUID()}@example.com`;
  adoptCookieString(await registerDirect(email, 'RBAC Browser Administrator'));
  assignRole(userIdForEmail(email), 'admin');
  await useAuthSession().refresh();
}

async function settle(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (pendingFetches.size > 0) await Promise.all([...pendingFetches]);
    await Promise.resolve();
    await nextTick();
  }
}

async function mountAt(path: string): Promise<void> {
  await router.push(path);
  await router.isReady();
  const mountedApplication = createApp(App).use(router);
  mountedApplication.mount(container);
  application = mountedApplication;
  await nextTick();
}

function setField(label: string, value: string, scope: ParentNode = document): void {
  const wrap = [...scope.querySelectorAll('.ab-field')].find((item) => item.querySelector('label')?.textContent?.replace('*', '').trim() === label);
  const input = wrap?.querySelector('input');
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing field ${label}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function dialog(title: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('.ab-dialog')].find((item) => item.querySelector('.ab-dialog-title')?.textContent?.trim() === title);
  if (!found) throw new Error(`Missing dialog ${title}`);
  return found;
}

async function clickText(text: string, scope: ParentNode = document): Promise<void> {
  const button = [...scope.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === text);
  if (!button) throw new Error(`Missing button ${text}`);
  button.click();
  await settle();
}

async function togglePermission(title: string, slug: string): Promise<void> {
  const target = dialog(title).querySelector<HTMLButtonElement>(`[data-permission-slug="${slug}"] [role="switch"]`);
  if (!target) throw new Error(`Missing permission ${slug}`);
  target.click();
  await nextTick();
}

const roleRow = (slug: string) => container.querySelector<HTMLTableRowElement>(`tr[data-role-slug="${slug}"]`);

beforeEach(async () => {
  container = document.createElement('div');
  document.body.append(container);
  application = undefined;
  cookieJar = new Map();
  document.cookie = 'auth_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  pendingFetches = new Set();
  seed();
  // Startup order: roles exist, then declared permissions are written and granted to admin.
  syncDeclaredPermissions();
  installApiFetch();
  await useAuthSession().logout();
  await router.push('/');
  await router.isReady();
});

afterEach(async () => {
  application?.unmount();
  application = undefined;
  await useAuthSession().logout();
  await router.push('/');
  container.remove();
  vi.unstubAllGlobals();
});

describe('roles and permissions browser surfaces', () => {
  it('shows the shipped permission catalog as stored, grouped by resource', async () => {
    await startAuthenticatedAdmin();
    await mountAt('/admin/peran');
    await settle();
    await clickText('Peran baru', container);

    const form = dialog('Peran baru');
    const usersGroup = [...form.querySelectorAll('section')].find((section) => section.querySelector('h3')?.textContent === 'Pengguna');
    expect(usersGroup?.querySelector('[data-permission-slug="users.reset-password"]')?.textContent).toContain('Atur ulang kata sandi pengguna');
    expect(form.querySelector('[data-permission-slug="activity.view"]')?.textContent).toContain('Lihat riwayat aktivitas');
    expect(roleRow('admin')?.textContent).toContain('Administrator');
    expect(roleRow('admin')?.textContent).toContain('Semua izin');
  });

  it('lists roles with server user counts and persists role permission CRUD', async () => {
    await startAuthenticatedAdmin();
    await mountAt('/admin/peran');
    await settle();

    const adminRoleId = roleIdForSlug('admin');
    expect(roleRow('admin')?.textContent).toMatch(/\d+ pengguna/);
    const adminBefore = getDatabase().prepare('SELECT * FROM roles WHERE id = ?').get(adminRoleId);

    const suffix = randomUUID().slice(0, 8);
    const name = `Operator TU ${suffix}`;
    const roleSlug = `operator-tu-${suffix}`;
    await clickText('Peran baru', container);
    setField('Nama peran', name, dialog('Peran baru'));
    await togglePermission('Peran baru', 'users.view');
    await clickText('Simpan', dialog('Peran baru'));

    const createdRow = roleRow(roleSlug);
    expect(createdRow?.textContent).toContain(name);
    expect(createdRow?.textContent).toContain('1 izin');
    expect(container.textContent).toContain(`Peran ${name} disimpan`);

    createdRow!.click();
    await settle();
    setField('Nama peran', `${name} Baru`, dialog(name));
    await togglePermission(name, 'users.edit');
    await clickText('Simpan', dialog(name));

    // The key stays what it was when the role was made; only the name changes.
    expect(roleRow(roleSlug)?.textContent).toContain(`${name} Baru`);
    expect(roleRow(roleSlug)?.textContent).toContain('2 izin');

    const rolesResponse = await serverApp.request('/api/roles', { headers: { Cookie: cookieHeader()! } });
    const rolesPayload = (await rolesResponse.json()) as {
      data: { roles: Array<{ slug: string; permissions: string[]; userCount: number }> };
    };
    expect(rolesPayload.data.roles.find((role) => role.slug === roleSlug)).toMatchObject({
      permissions: expect.arrayContaining(['users.view', 'users.edit']),
      userCount: 0,
    });

    roleRow(roleSlug)!.click();
    await settle();
    await clickText('Hapus peran', dialog(`${name} Baru`));
    await clickText('Hapus', dialog(`Hapus ${name} Baru?`));
    expect(roleRow(roleSlug)).toBeNull();

    // Administrator is not opened from here, and the server refuses changes to it anyway.
    expect(roleRow('admin')?.querySelector('button')).toBeNull();
    roleRow('admin')!.click();
    await settle();
    expect([...document.querySelectorAll('.ab-dialog-title')].map((title) => title.textContent)).not.toContain('Administrator');

    const updateResponse = await createAccessClient().updateRole(adminRoleId, { revision: 1, name: 'Renamed Administrator' });
    expect(updateResponse).toMatchObject({
      success: false,
      message: 'Cannot edit the admin role',
      code: 'PROTECTED_ROLE',
    });
    expect(getDatabase().prepare('SELECT * FROM roles WHERE id = ?').get(adminRoleId)).toEqual(adminBefore);

    const deleteResponse = await createAccessClient().deleteRoles({ ids: [adminRoleId] });
    expect(deleteResponse).toMatchObject({
      success: false,
      message: 'Cannot delete the admin role',
      code: 'PROTECTED_ROLE',
    });
    expect(roleRow('admin')).not.toBeNull();
  });
});
