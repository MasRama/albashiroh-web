import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/app/App.vue';
import router from '../../src/app/router';

describe('Vue frontend shell', () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof createApp> | undefined;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.append(container);
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    await router.push('/');
  });

  afterEach(async () => {
    app?.unmount();
    app = undefined;
    await router.push('/');
    container.remove();
    document.documentElement.classList.remove('dark');
  });

  async function mountAt(path: string): Promise<void> {
    await router.push(path);
    await router.isReady();
    app = createApp(App).use(router);
    app.mount(container);
    await nextTick();
  }

  it('renders the Yayasan home in the site frame and moves to a school portal without a document reload', async () => {
    await mountAt('/');

    const documentElement = document.documentElement;
    const site = container.querySelector('.site');
    expect(site?.classList.contains('site--yayasan')).toBe(true);
    expect(container.querySelector('h1')?.textContent).toContain("Generasi Qur'ani");
    expect(container.querySelector('nav')).not.toBeNull();
    expect(container.querySelector('footer')).not.toBeNull();

    const smpLink = container.querySelector<HTMLAnchorElement>('a[href="/smp"]');
    expect(smpLink).not.toBeNull();
    smpLink?.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(router.currentRoute.value.path).toBe('/smp');
    expect(container.querySelector('.site')?.classList.contains('site--smp')).toBe(true);
    expect(document.documentElement).toBe(documentElement);
  });

  it('opens the admin sign-in page outside the site frame', async () => {
    await mountAt('/admin/masuk');

    expect(container.querySelector('.site')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toContain('Masuk ke panel admin');
  });

  it('keeps /login as a way to the admin sign-in page', async () => {
    await mountAt('/login');

    expect(router.currentRoute.value.name).toBe('login');
    expect(container.querySelector('h1')?.textContent).toContain('Masuk ke panel admin');
    expect(container.querySelector('form')).not.toBeNull();
  });

  it('signs in on the Al Bashiroh frame with a password the visitor can reveal, and no registration', async () => {
    await mountAt('/admin/masuk');

    expect(container.querySelector('[data-testid="sign-in-page"]')).not.toBeNull();
    expect(container.textContent).toContain('Al Bashiroh');
    expect(container.querySelectorAll('form .ab-field input')).toHaveLength(2);
    expect(container.querySelector('a[href="/register"]')).toBeNull();

    const password = container.querySelector<HTMLInputElement>('input[autocomplete="current-password"]');
    expect(password?.type).toBe('password');
    container.querySelector<HTMLButtonElement>('button[aria-label="Tampilkan kata sandi"]')?.click();
    await nextTick();
    expect(password?.type).toBe('text');
    expect(container.querySelector('button[aria-label="Sembunyikan kata sandi"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders the 404 page in the site frame for unknown browser routes, under the school an address belongs to', async () => {
    await mountAt('/this-route-does-not-exist');

    expect(container.querySelector('[data-testid="not-found-page"]')).not.toBeNull();
    expect(container.querySelector('h1')?.textContent).toContain('Halaman tidak ditemukan');
    expect(container.querySelector('.site')?.classList.contains('site--yayasan')).toBe(true);
    expect(container.querySelector('[data-testid="not-found-page"] a[href="/"]')).not.toBeNull();

    await router.push('/smp/tidak-ada');
    await nextTick();
    expect(container.querySelector('[data-testid="not-found-page"] a[href="/smp"]')).not.toBeNull();
    expect(container.querySelector('.site')?.classList.contains('site--smp')).toBe(true);
  });
});
