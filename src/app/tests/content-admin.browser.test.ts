/// <reference lib="dom" />
import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.vue';
import router from '../router';
import { app as serverApp } from '../server';
import { useAuthSession } from '../../features/auth/web';
import { seed } from '../../shared/database';
import { closeEventStreams } from '../../shared/realtime';
import { mergeResponseCookies } from '../../shared/security/tests/helpers';
import { grantRole, signUp } from './personas';

/**
 * A portal editor writing in the real admin, against the real server: the
 * entry form shows only what the type holds, says when a photo is missing,
 * and a saved entry turns up in its list and on the public site.
 */
let container: HTMLDivElement;
let application: { unmount(): void } | undefined;
let tabCookie = '';
let pending: Set<Promise<unknown>>;

function track<T>(promise: Promise<T>): Promise<T> {
  pending.add(promise);
  void promise.finally(() => pending.delete(promise)).catch(() => undefined);
  return promise;
}

/** Live updates are covered by live-browser.test.ts; here the stream simply stays quiet. */
class QuietEventSource extends EventTarget {
  readyState = 0;
  close(): void {
    this.readyState = 2;
  }
}

function installTabFetch(): void {
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    track(
      (async () => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://nara.test');
        const headers = new Headers(init?.headers);
        if (tabCookie) headers.set('Cookie', tabCookie);
        const response = await serverApp.request(url.pathname + url.search, { method: init?.method ?? 'GET', headers, body: init?.body });
        tabCookie = mergeResponseCookies(tabCookie, response);
        for (const pair of tabCookie.split('; ')) if (pair.startsWith('csrf_token=')) document.cookie = `${pair}; path=/`;
        return response;
      })(),
    ),
  );
}

async function settle(): Promise<void> {
  for (let round = 0; round < 12; round += 1) {
    if (pending.size > 0) await Promise.allSettled([...pending]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await nextTick();
  }
}

async function openTab(cookie: string, path: string): Promise<void> {
  tabCookie = cookie;
  await useAuthSession().refresh();
  await router.push(path);
  await router.isReady();
  const mounted = createApp(App).use(router);
  mounted.mount(container);
  application = mounted;
  await settle();
}

async function smpEditor() {
  const editor = await signUp('Editor SMP');
  grantRole(editor.id, 'editor-smp');
  return editor;
}

function field(label: string): HTMLInputElement | HTMLTextAreaElement {
  const box = [...container.querySelectorAll('.ab-field')].find((candidate) => candidate.querySelector('.ab-field-label')?.textContent?.replace(' *', '').trim() === label);
  if (!box) throw new Error(`No field labelled ${label}`);
  return box.querySelector('input, textarea')!;
}

function type(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

beforeEach(async () => {
  seed();
  container = document.createElement('div');
  document.body.append(container);
  application = undefined;
  tabCookie = '';
  pending = new Set();
  installTabFetch();
  vi.stubGlobal('EventSource', QuietEventSource);
  await useAuthSession().refresh();
  await router.push('/');
  await router.isReady();
});

afterEach(async () => {
  application?.unmount();
  closeEventStreams();
  await settle();
  container.remove();
  for (const layer of document.querySelectorAll('.ab-dialog-layer')) layer.remove();
  tabCookie = '';
  await useAuthSession().refresh();
  vi.unstubAllGlobals();
});

describe('portal content in the admin', () => {
  it('writes and publishes a news entry that shows in the list and on the site', async () => {
    const editor = await smpEditor();
    await openTab(editor.cookie, '/admin/smp/berita/baru');
    expect(router.currentRoute.value.name).toBe('portal-smp-new');

    // Only the parts a news entry has, with the missing photo said plainly.
    expect(field('Judul')).toBeTruthy();
    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Format Isi berita');
    expect(container.textContent).toContain('Belum ada gambar, unggah sekarang');
    expect(() => field('Pelatih')).toThrow();

    type(field('Judul'), 'Wisuda Tahfidz Angkatan Ketiga');
    type(field('Ringkasan'), 'Dua puluh santri menuntaskan hafalan 30 juz.');
    container.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="false"]')!.click();
    await settle();
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain('Simpan & terbitkan');

    container.querySelector<HTMLFormElement>('form.ee')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();

    expect(router.currentRoute.value.name).toBe('portal-smp-entry');
    const id = router.currentRoute.value.params.id as string;

    await router.push('/admin/smp/berita');
    await settle();
    const row = container.querySelector(`[data-entry-id="${id}"]`);
    expect(row?.textContent).toContain('Wisuda Tahfidz Angkatan Ketiga');
    expect(row?.textContent).toContain('Terbit');

    const site = (await (await serverApp.request('/api/site/smp/berita')).json()) as { data: { items: { title: string; image: unknown }[] } };
    expect(site.data.items.map((item) => item.title)).toContain('Wisuda Tahfidz Angkatan Ketiga');
    expect(site.data.items.find((item) => item.title === 'Wisuda Tahfidz Angkatan Ketiga')?.image).toBeNull();
  });

  it('saves the portal settings from the Simpan button and shows them on the site', async () => {
    const editor = await smpEditor();
    await openTab(editor.cookie, '/admin/smp/pengaturan');
    expect(router.currentRoute.value.name).toBe('portal-smp-settings');

    type(field('Judul besar'), 'Wujudkan generasi bertaqwa dan berprestasi.');
    // A bare address gets its https:// as the editor saves.
    type(field('Instagram'), 'instagram.com/smpitalbashiroh');
    await settle();
    container.querySelector<HTMLButtonElement>('form.ps button[type="submit"]')!.click();
    await settle();

    expect(container.textContent).toContain('Disimpan');
    expect(container.textContent).not.toContain('Ada perubahan yang belum disimpan');
    const site = (await (await serverApp.request('/api/site/smp')).json()) as { data: { settings: { heroTitle: string; contact: { instagram: string } } } };
    expect(site.data.settings.heroTitle).toBe('Wujudkan generasi bertaqwa dan berprestasi.');
    expect(site.data.settings.contact.instagram).toBe('https://instagram.com/smpitalbashiroh');
  });

  it('keeps an SMP editor out of the SMA portal', async () => {
    const editor = await smpEditor();
    await openTab(editor.cookie, '/admin/sma');
    expect(String(router.currentRoute.value.name)).not.toMatch(/^portal-sma/);
  });
});
