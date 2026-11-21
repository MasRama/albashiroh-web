/// <reference lib="dom" />
import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.vue';
import router from '../router';
import { app as serverApp } from '../server';
import { emptySettings, type Portal, type PortalSettings } from '../../features/content/web';
import { getDatabase, seed } from '../../shared/database';
import { closeEventStreams } from '../../shared/realtime';
import { csrfHeaders, issueCsrf } from '../../shared/security/tests/helpers';
import { forgetPortals } from '../site/site';
import { grantAdmin, signUp, type Persona } from './personas';

/**
 * A visitor on the public site, against the real server: what the schools
 * publish in the admin shows on the Yayasan and portal pages, drafts and
 * unknown addresses do not, and the gallery and PPDB pages work by hand.
 * All content here is made up for the test.
 */
let container: HTMLDivElement;
let application: { unmount(): void } | undefined;
let pending: Set<Promise<unknown>>;
let admin: Persona;

function track<T>(promise: Promise<T>): Promise<T> {
  pending.add(promise);
  void promise.finally(() => pending.delete(promise)).catch(() => undefined);
  return promise;
}

class QuietEventSource extends EventTarget {
  readyState = 0;
  close(): void {
    this.readyState = 2;
  }
}

// The visitor's browser: no cookies, every request answered by the real app.
function installVisitorFetch(): void {
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    track(
      (async () => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://nara.test');
        return serverApp.request(url.pathname + url.search, { method: init?.method ?? 'GET', headers: init?.headers });
      })(),
    ),
  );
}

async function settle(): Promise<void> {
  for (let round = 0; round < 14; round += 1) {
    if (pending.size > 0) await Promise.allSettled([...pending]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await nextTick();
  }
}

/** Waits for a lazily loaded page: a click resolves its route only once the page's code arrives. */
async function until(condition: () => boolean): Promise<void> {
  for (let round = 0; round < 200 && !condition(); round += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  await settle();
}

async function visit(path: string): Promise<void> {
  await router.push(path);
  await router.isReady();
  if (!application) {
    const mounted = createApp(App).use(router);
    mounted.mount(container);
    application = mounted;
  }
  await settle();
}

async function adminSend(method: string, path: string, body: unknown): Promise<Response> {
  const csrf = await issueCsrf(serverApp, admin.cookie);
  const response = await serverApp.request(`/api/content${path}`, {
    method,
    headers: csrfHeaders(csrf, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  expect(response.status, `${method} ${path}: ${await response.clone().text()}`).toBeLessThan(300);
  return response;
}

function publish(portal: Portal, type: string, entry: Record<string, unknown>): Promise<Response> {
  return adminSend('POST', `/${portal}/${type}`, { status: 'published', ...entry });
}

async function saveSettings(portal: Portal, change: (settings: PortalSettings) => void): Promise<void> {
  const settings = emptySettings();
  change(settings);
  await adminSend('PUT', `/${portal}/settings`, { settings, revision: 0 });
}

const text = () => container.textContent ?? '';

beforeEach(async () => {
  seed();
  getDatabase().prepare('DELETE FROM content_entries').run();
  getDatabase().prepare('DELETE FROM portal_settings').run();
  container = document.createElement('div');
  document.body.append(container);
  application = undefined;
  pending = new Set();
  admin = await signUp('Admin Situs');
  grantAdmin(admin.id);
  forgetPortals();
  installVisitorFetch();
  vi.stubGlobal('EventSource', QuietEventSource);
});

afterEach(async () => {
  application?.unmount();
  application = undefined;
  closeEventStreams();
  await settle();
  container.remove();
  vi.unstubAllGlobals();
  await router.push('/admin/masuk');
});

describe('the public site', () => {
  it('shows both schools’ published news on the Yayasan home, with their level, and opens an article', async () => {
    await saveSettings('yayasan', (settings) => {
      settings.heroTitle = 'Santri yang *cinta Al-Qur’an.*';
    });
    await publish('smp', 'berita', { title: 'Lomba tahfidz antar kelas', summary: 'Diikuti semua kelas.', body: '<p>Para siswa membaca hafalan juz 30.</p>', fields: { category: 'Keagamaan' } });
    await publish('sma', 'berita', { title: 'Kunjungan kampus ke Malang', summary: 'Siswa kelas 12 berkunjung.' });
    await publish('sma', 'berita', { title: 'Draf yang belum siap', status: 'draft' });

    await visit('/');
    const accent = container.querySelector('.hero h1 em');
    expect(accent?.textContent).toBe('cinta Al-Qur’an.');
    expect(container.querySelector('.hero h1')?.textContent).not.toContain('*');
    expect(text()).toContain('Lomba tahfidz antar kelas');
    expect(text()).toContain('Kunjungan kampus ke Malang');
    expect(text()).not.toContain('Draf yang belum siap');
    const smpCard = [...container.querySelectorAll<HTMLAnchorElement>('a.s-news')].find((card) => card.textContent?.includes('Lomba tahfidz'));
    expect(smpCard?.querySelector('.s-lvl')?.textContent).toBe('SMP');
    expect(smpCard?.getAttribute('href')).toBe('/smp/berita/lomba-tahfidz-antar-kelas');

    smpCard?.click();
    await until(() => router.currentRoute.value.path !== '/');
    expect(router.currentRoute.value.path).toBe('/smp/berita/lomba-tahfidz-antar-kelas');
    expect(container.querySelector('.site')?.classList.contains('site--smp')).toBe(true);
    expect(container.querySelector('h1')?.textContent).toBe('Lomba tahfidz antar kelas');
    expect(container.querySelector('.ep-body')?.textContent).toContain('Para siswa membaca hafalan juz 30.');
    expect(document.title).toBe('Lomba tahfidz antar kelas | SMP IT Al Bashiroh');
  });

  it('builds a school home from its settings and entries, and keeps the alumni to the SMA', async () => {
    await saveSettings('sma', (settings) => {
      settings.visi = 'Bertaqwa, berilmu, dan mandiri.';
      settings.misi = ['Menumbuhkan kecintaan kepada Al-Qur’an.', 'Membentuk karakter mandiri.'];
      settings.prakata = { name: 'Ustadz Contoh', role: 'Kepala sekolah', photoId: null, body: '<p>Selamat datang di sekolah kami.</p>' };
      settings.kompetensi = [{ name: 'Hadits Arba’in', detail: '', target: '42 hadits' }];
    });
    await publish('sma', 'faq', { title: 'Apakah siswa wajib berasrama?', body: '<p>Ya, seluruh siswa tinggal di asrama.</p>' });
    await publish('sma', 'alumni', { title: 'Alumni Contoh', summary: 'Kini kuliah.', fields: { year: '2024', now: 'Universitas Contoh' } });

    await visit('/sma');
    expect(container.querySelector('.sh-card b')?.textContent).toBe('Bertaqwa, berilmu, dan mandiri.');
    expect(container.querySelector('.sh-prakata')?.textContent).toContain('Selamat datang di sekolah kami.');
    expect([...container.querySelectorAll('.sh-misi li')].map((item) => item.textContent)).toEqual(['01Menumbuhkan kecintaan kepada Al-Qur’an.', '02Membentuk karakter mandiri.']);
    expect(container.querySelector('.sh-big')?.textContent).toBe('42hadits');
    expect(text()).toContain('Apakah siswa wajib berasrama?');
    expect(text()).toContain('Ya, seluruh siswa tinggal di asrama.');
    expect(container.querySelector('a[href="/sma/alumni"]')).not.toBeNull();

    await visit('/sma/alumni');
    expect(text()).toContain('Alumni Contoh');
    expect(text()).toContain('Universitas Contoh');

    await visit('/smp/alumni');
    expect(container.querySelector('[data-testid="not-found-page"]')).not.toBeNull();
    expect(container.querySelector('.site')?.classList.contains('site--smp')).toBe(true);
  });

  it('plays the profile video on a home page once the visitor asks, and shows nothing while no link is set', async () => {
    await visit('/smp');
    expect(container.querySelector('.pv')).toBeNull();

    await saveSettings('yayasan', (settings) => {
      settings.video.url = 'https://www.youtube.com/watch?v=abcdefghijk';
      settings.home.text['video.title'] = 'Sehari di Al Bashiroh.';
    });
    forgetPortals();
    await visit('/');
    expect(container.querySelector('.pv h2')?.textContent).toBe('Sehari di Al Bashiroh.');
    expect(container.querySelector('.pv .s-kick')?.textContent).toBe('Video profil');
    // YouTube is not contacted for the player until play is pressed.
    expect(container.querySelector('.pv iframe')).toBeNull();
    expect(container.querySelector<HTMLImageElement>('.pv-poster img')?.src).toBe('https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg');
    container.querySelector<HTMLButtonElement>('.pv-poster')!.click();
    await settle();
    expect(container.querySelector<HTMLIFrameElement>('.pv iframe')?.src).toBe('https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&rel=0');
  });

  it('shows the words the school wrote for a home page section, and leaves out a section it took off', async () => {
    await publish('sma', 'faq', { title: 'Apakah siswa wajib berasrama?', body: '<p>Ya.</p>' });
    await saveSettings('sma', (settings) => {
      settings.home.hidden = ['faq'];
      settings.home.text = { 'news.title': 'Cerita dari SMA.', 'hero.primary': 'Gabung sekarang', 'ppdb.title': 'Ayo sekolah di sini.' };
    });
    await saveSettings('yayasan', (settings) => {
      settings.home.hidden = ['schools', 'ppdb'];
      settings.home.text = { 'takhosus.value': '15', 'about.guruTitle': 'Para pendidik' };
    });

    await visit('/sma');
    expect(text()).toContain('Cerita dari SMA.');
    expect(text()).not.toContain('Berita & agenda terbaru.');
    expect(container.querySelector('.hero-cta a')?.textContent?.trim()).toBe('Gabung sekarang');
    expect(container.querySelector('.s-ppdb h2')?.textContent).toBe('Ayo sekolah di sini.');
    expect(text()).not.toContain('Apakah siswa wajib berasrama?');

    await visit('/');
    expect(container.querySelector('.yh-portals')).toBeNull();
    expect(container.querySelector('.s-ppdb')).toBeNull();
    expect(container.querySelector('.yh-big')?.textContent).toBe('15juz');
    expect(text()).toContain('Para pendidik');
    // A text the school left alone keeps its wording.
    expect(text()).toContain('Kabar terbaru.');
  });

  it('answers an unpublished article address with the 404 page', async () => {
    await publish('smp', 'berita', { title: 'Masih draf', status: 'draft' });

    await visit('/smp/berita/masih-draf');
    expect(container.querySelector('[data-testid="not-found-page"]')).not.toBeNull();
    expect(text()).not.toContain('Masih draf');
  });

  it('opens a gallery item in the lightbox, steps through it, and closes it', async () => {
    await publish('yayasan', 'galeri', { title: 'Manasik haji', date: '2026-10-01' });
    await publish('smp', 'galeri', { title: 'Latihan pramuka', date: '2026-09-01', fields: { video: 'https://youtu.be/dQw4w9WgXcQ' } });

    await visit('/galeri');
    const items = container.querySelectorAll<HTMLButtonElement>('.lp-gal-item');
    expect(items).toHaveLength(2);
    items[0]!.click();
    await settle();
    const dialog = document.querySelector<HTMLDialogElement>('dialog.lb');
    expect(dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain('Manasik haji');

    dialog?.querySelector<HTMLButtonElement>('button[aria-label="Berikutnya"]')?.click();
    await settle();
    expect(dialog?.textContent).toContain('Latihan pramuka');
    expect(dialog?.querySelector('iframe')?.getAttribute('src')).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');

    dialog?.querySelector<HTMLButtonElement>('button[aria-label="Tutup"]')?.click();
    await settle();
    expect(dialog?.open).toBe(false);
  });

  it('shows a video with no photo by its YouTube thumbnail, on the home page as on the gallery', async () => {
    await publish('smp', 'galeri', { title: 'Latihan pramuka', date: '2026-09-01', fields: { video: 'https://youtu.be/dQw4w9WgXcQ' } });
    const thumbnail = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg';

    await visit('/');
    expect(container.querySelector('.yh-gal-item img')?.getAttribute('src')).toBe(thumbnail);
    expect(container.querySelector('.yh-gal-item .s-play')).not.toBeNull();

    await visit('/galeri');
    expect(container.querySelector('.lp-gal-item img')?.getAttribute('src')).toBe(thumbnail);
  });

  it('switches PPDB between the schools, each with its own WhatsApp', async () => {
    await saveSettings('smp', (settings) => {
      settings.contact.whatsapp = '6281100000001';
      settings.ppdb.flow = '<p>Alur khusus SMP.</p>';
    });
    await saveSettings('sma', (settings) => {
      settings.contact.whatsapp = '6281100000002';
    });

    await visit('/ppdb?jenjang=smp');
    expect(container.querySelector('.pd-flow')?.textContent).toContain('Alur khusus SMP.');
    expect(container.querySelector<HTMLAnchorElement>('.pd-form a')?.href).toContain('https://wa.me/6281100000001');

    const smaTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((tab) => tab.textContent?.includes('SMA'));
    smaTab?.click();
    await settle();
    expect(router.currentRoute.value.query.jenjang).toBe('sma');
    expect(smaTab?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector<HTMLAnchorElement>('.pd-form a')?.href).toContain('https://wa.me/6281100000002');
    expect(container.querySelector('.pd-flow')).toBeNull();
  });
});
