/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../../app/App.vue';
import router from '../../../../app/router';
import { app as serverApp } from '../../../../app/server';
import { getDatabase } from '../../../../shared/database';
import { createTestAccount, signIn } from '../../../../app/tests/personas';
import { createAuthClient, createAuthSession, useAuthSession, type AuthClient, type CurrentUser } from '../../web';
import { createSecurityClient } from '../../web/security-client';
import { totpCode, totpStep } from '../../server/totp';

const TEST_PASSWORD = 'correct horse battery staple';

let container: HTMLDivElement;
let application: { unmount(): void } | undefined;
let cookieJar: Map<string, string>;
let fetchPaths: string[];
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

function setSessionCookie(value: string | undefined): void {
  if (value === undefined) {
    cookieJar.delete('auth_id');
    document.cookie = 'auth_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  } else {
    cookieJar.set('auth_id', value);
    document.cookie = `auth_id=${value}; path=/`;
  }
}
function installApiFetch(): void {
  const request = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(inputUrl, 'http://nara.test');
    fetchPaths.push(url.pathname);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    for (const [name, value] of new Headers(init?.headers)) {
      headers.set(name, value);
    }
    const jar = cookieHeader();
    if (jar) headers.set('Cookie', jar);

    const response = await serverApp.request(url.pathname + url.search, {
      method: init?.method,
      headers,
      body: init?.body,
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
async function registerDirect(email: string): Promise<void> {
  await createTestAccount('Existing User', email, TEST_PASSWORD);
  adoptCookieString(await signIn(email, TEST_PASSWORD));
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
  return new Promise((resolve) => {
    const removeHook = router.afterEach(() => {
      removeHook();
      resolve();
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

// The admin's own screens: inputs found by their label; dialogs teleported to the body.
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

function button(text: string, scope: ParentNode = document): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.trim() === text);
}

function submitForm(): void {
  const form = container.querySelector('form');
  if (!(form instanceof HTMLFormElement)) throw new Error('Missing auth form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(async () => {
  container = document.createElement('div');
  document.body.append(container);
  application = undefined;
  cookieJar = new Map();
  document.cookie = 'auth_id=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  fetchPaths = [];
  pendingFetches = new Set();
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

describe('browser authentication lifecycle', () => {
  it('renders login errors and loading state', async () => {
    const email = `login-error-${Date.now()}@example.com`;
    await registerDirect(email);
    await useAuthSession().logout();
    await mountAt('/admin/masuk');

    setField('Email', email);
    setField('Kata sandi', 'wrong password');
    submitForm();

    await nextTick();
    const loginErrorButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(loginErrorButton?.disabled).toBe(true);
    expect(loginErrorButton?.getAttribute('aria-busy')).toBe('true');
    await settle();

    expect(router.currentRoute.value.name).toBe('login');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Email atau kata sandi salah.');
    expect(useAuthSession().status.value).toBe('unauthenticated');
  });

  it('bootstraps an existing session once and resolves missing or expired sessions as guests', async () => {
    const email = `bootstrap-${Date.now()}@example.com`;
    await registerDirect(email);
    const session = createAuthSession();

    await Promise.all([session.load(), session.load()]);

    expect(session.status.value).toBe('authenticated');
    expect(session.user.value?.email).toBe(email);
    expect(fetchPaths.filter((path) => path === '/api/auth/me')).toHaveLength(1);

    setSessionCookie(undefined);
    const missingSession = createAuthSession();
    await missingSession.load();
    expect(missingSession.status.value).toBe('unauthenticated');

    setSessionCookie('expired-session');
    const expiredSession = createAuthSession();
    await expiredSession.load();
    expect(expiredSession.status.value).toBe('unauthenticated');
  });

  it('preserves established auth state across transient current-user failures and clears it only on unauthorized', async () => {
    const user: CurrentUser = {
      id: 'session-user',
      name: 'Session User',
      email: 'session@example.com',
      avatar: null,
      roles: ['admin'],
      permissions: ['users.view'],
      mustChangePassword: false,
    };
    const me = vi
      .fn()
      .mockResolvedValueOnce({ success: true, message: 'OK', data: { user } })
      .mockResolvedValueOnce({ success: false, message: 'Server unavailable', code: 'INTERNAL_ERROR' })
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' });
    const session = createAuthSession({ me } as unknown as AuthClient);

    await session.load();
    expect(session.isAuthenticated.value).toBe(true);

    await expect(session.refresh()).rejects.toThrow('Server unavailable');
    expect(session.isAuthenticated.value).toBe(true);
    expect(session.user.value).toEqual(user);

    await expect(session.refresh()).rejects.toThrow('network unavailable');
    expect(session.isAuthenticated.value).toBe(true);
    expect(session.user.value).toEqual(user);

    await expect(session.refresh()).resolves.toBe(false);
    expect(session.status.value).toBe('unauthenticated');
    expect(session.user.value).toBeNull();
  });

  it('revalidates an established session before protected navigation and redirects when it was revoked', async () => {
    const email = `revoked-${Date.now()}@example.com`;
    await registerDirect(email);
    await useAuthSession().refresh();
    await mountAt('/admin');
    expect(useAuthSession().isAuthenticated.value).toBe(true);

    setSessionCookie(undefined);
    await router.push('/admin/profil');
    await router.isReady();

    expect(useAuthSession().status.value).toBe('unauthenticated');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/admin/profil');
  });

  it('redirects guests to login and returns them to the protected destination after login', async () => {
    const email = `login-${Date.now()}@example.com`;
    await registerDirect(email);
    await useAuthSession().logout();

    await mountAt('/admin');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/admin');

    const documentElement = document.documentElement;
    setField('Email', email);
    setField('Kata sandi', TEST_PASSWORD);
    const navigation = waitForNavigation();
    submitForm();
    await nextTick();
    const loginButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(loginButton?.disabled).toBe(true);
    expect(loginButton?.getAttribute('aria-busy')).toBe('true');
    await navigation;
    await settle();

    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(container.querySelector('[data-testid="dashboard-page"]')?.textContent).toContain("Assalamu'alaikum, Existing.");
    expect(useAuthSession().isAuthenticated.value).toBe(true);
    expect(document.documentElement).toBe(documentElement);
  });

  it('asks for an authenticator code after the password when two-factor is on', async () => {
    const email = `two-factor-${Date.now()}@example.com`;
    await registerDirect(email);
    const security = createSecurityClient();
    const setup = await security.startTwoFactorSetup({ password: TEST_PASSWORD });
    const secret = setup.success ? setup.data!.secret : '';
    expect((await security.enableTwoFactor({ code: totpCode(secret, totpStep()) })).success).toBe(true);
    await useAuthSession().logout();

    await mountAt('/admin/masuk');
    setField('Email', email);
    setField('Kata sandi', TEST_PASSWORD);
    submitForm();
    await settle();
    expect(container.querySelector('h1')?.textContent).toContain('Verifikasi dua langkah');
    expect(useAuthSession().isAuthenticated.value).toBe(false);

    setField('Kode authenticator', '000000');
    submitForm();
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Kodenya salah. Coba lagi.');

    const navigation = waitForNavigation();
    setField('Kode authenticator', totpCode(secret, totpStep() + 1));
    submitForm();
    await navigation;
    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(useAuthSession().isAuthenticated.value).toBe(true);
  });

  it('enrolls two-factor from the security page and shows the current device', async () => {
    const email = `security-page-${Date.now()}@example.com`;
    await registerDirect(email);
    await useAuthSession().refresh();
    await mountAt('/admin/keamanan');
    await settle();

    const sessionRows = container.querySelectorAll('[data-testid="session-row"]');
    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0]?.textContent).toContain('Perangkat ini');

    button('Aktifkan', container)!.click();
    await nextTick();
    setField('Kata sandi', TEST_PASSWORD, dialog('Aktifkan verifikasi'));
    button('Lanjut', dialog('Aktifkan verifikasi'))!.click();
    await settle();

    const scan = dialog('Hubungkan aplikasi');
    expect(scan.querySelector('[data-testid="two-factor-qr"] path')?.getAttribute('d')).toMatch(/^M\d/);
    expect(scan.querySelector('[data-testid="two-factor-link"]')?.getAttribute('href')).toMatch(/^otpauth:\/\/totp\//);
    const secret = scan.querySelector('[data-testid="two-factor-secret"]')!.textContent!.replace(/\s/g, '');
    setField('Kode 6 angka', totpCode(secret, totpStep()), scan);
    button('Aktifkan', scan)!.click();
    await settle();

    expect(dialog('Simpan kode pemulihan').querySelectorAll('[data-testid="recovery-codes"] code')).toHaveLength(10);
    button('Selesai', dialog('Simpan kode pemulihan'))!.click();
    await settle();
    expect(container.querySelector('[data-testid="two-factor-left"]')?.textContent).toBe('10');
  });

  it('forces temporary-password users through password change before dashboard access', async () => {
    const email = `temporary-${Date.now()}@example.com`;
    const replacement = 'replacement browser password';
    await registerDirect(email);
    getDatabase().prepare('UPDATE users SET must_change_password = 1 WHERE email = ?').run(email);
    await useAuthSession().logout();

    await mountAt('/admin/masuk');
    setField('Email', email);
    setField('Kata sandi', TEST_PASSWORD);
    const forcedNavigation = waitForNavigation();
    submitForm();
    await forcedNavigation;
    await settle();

    expect(router.currentRoute.value.name).toBe('change-password');
    expect(container.querySelector('h1')?.textContent).toContain('Buat kata sandi baru');
    expect(container.querySelector('[data-testid="password-page"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="admin-shell"]')).toBeNull();
    expect(container.querySelector('[aria-label="Navigasi admin"]')).toBeNull();
    expect(useAuthSession().user.value?.mustChangePassword).toBe(true);

    // Nothing else opens until the password is changed.
    await router.push('/admin/pengguna');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('change-password');

    setField('Kata sandi sekarang', TEST_PASSWORD);
    setField('Kata sandi baru', replacement);
    setField('Ulangi kata sandi baru', replacement);
    const dashboardNavigation = waitForNavigation();
    submitForm();
    await dashboardNavigation;
    await settle();

    expect(router.currentRoute.value.name).toBe('dashboard');
    expect(useAuthSession().user.value?.mustChangePassword).toBe(false);
    expect(fetchPaths).toContain('/api/auth/change-password');
  });

  it('logs out through the server and protects the route again', async () => {
    const email = `logout-${Date.now()}@example.com`;
    await registerDirect(email);
    await useAuthSession().refresh();
    await mountAt('/admin');

    const logoutButton = button('Keluar', container);
    expect(logoutButton).toBeDefined();
    const navigation = waitForNavigation();
    logoutButton?.click();
    await navigation;

    expect(router.currentRoute.value.name).toBe('login');
    expect(useAuthSession().status.value).toBe('unauthenticated');
    const currentUserResponse = await serverApp.request('/api/auth/me', {
      headers: { Cookie: cookieHeader() ?? '' },
    });
    expect(currentUserResponse.status).toBe(401);

    await router.push('/admin');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('login');
  });
});

// An application may replace Auth's pages with its own: everything a sign-in
// page needs comes from the Auth web boundary, so the replacement imports
// nothing private and Auth stays evolvable underneath it.
describe('application-owned auth pages', () => {
  it('signs in through a page built only on createAuthClient and useAuthSession', async () => {
    const email = `own-page-${Date.now()}@example.com`;
    await registerDirect(email);
    await useAuthSession().logout();

    const OwnSignIn = defineComponent(() => {
      const client = createAuthClient();
      const session = useAuthSession();
      const message = ref('');
      async function submit(event: Event) {
        event.preventDefault();
        const result = await client.login({ email, password: TEST_PASSWORD });
        if (!result.success) message.value = result.message;
        else await session.refresh();
      }
      return () =>
        h('form', { onSubmit: submit }, [
          h('p', { role: 'status' }, session.isAuthenticated.value ? `Signed in as ${session.user.value?.email}` : message.value),
          h('button', { type: 'submit' }, 'Sign in'),
        ]);
    });
    const mounted = createApp(OwnSignIn);
    mounted.mount(container);
    application = mounted;

    submitForm();
    await settle();

    expect(container.querySelector('[role="status"]')?.textContent).toBe(`Signed in as ${email}`);
    expect(useAuthSession().isAuthenticated.value).toBe(true);
  });

  it('offers no registration link when the application routes no register page', async () => {
    expect(router.hasRoute('register')).toBe(false);
    await mountAt('/admin/masuk');
    expect(container.querySelector('a[href="/register"]')).toBeNull();
    expect(container.textContent).toContain('Minta administrator sekolah membuatkannya.');
    expect(container.querySelector('form')).not.toBeNull();
  });
});
