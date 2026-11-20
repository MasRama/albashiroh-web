/// <reference lib="dom" />
import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.vue';
import router from '../router';
import { app as serverApp } from '../server';
import { useAuthSession } from '../../features/auth/web';
import { emptyPpdbSettings, type PpdbSettings } from '../../features/ppdb/web';
import { getDatabase, seed } from '../../shared/database';
import { closeEventStreams } from '../../shared/realtime';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../shared/security/tests/helpers';
import { grantRole, signUp, type Persona } from './personas';

/**
 * A family registering on the public PPDB page and the committee picking it
 * up in the admin, against the real server. Every name and number here is
 * made up for the test.
 */
let container: HTMLDivElement;
let application: { unmount(): void } | undefined;
let tabCookie = '';
let pending: Set<Promise<unknown>>;
let committee: Persona;

function track<T>(promise: Promise<T>): Promise<T> {
  pending.add(promise);
  void promise.finally(() => pending.delete(promise)).catch(() => undefined);
  return promise;
}

// jsdom lays nothing out, so it has no scrolling; the form scrolls to errors and to the receipt.
Element.prototype.scrollIntoView ??= () => undefined;

class QuietEventSource extends EventTarget {
  readyState = 0;
  close(): void {
    this.readyState = 2;
  }
}

// One browser tab: its cookies, every request answered by the real app.
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
  for (let round = 0; round < 14; round += 1) {
    if (pending.size > 0) await Promise.allSettled([...pending]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await nextTick();
  }
}

async function until(condition: () => boolean): Promise<void> {
  for (let round = 0; round < 200 && !condition(); round += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  await settle();
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

async function configure(change: (settings: PpdbSettings) => void): Promise<void> {
  const settings = emptyPpdbSettings();
  change(settings);
  const csrf = await issueCsrf(serverApp, committee.cookie);
  const response = await serverApp.request('/api/ppdb/settings', {
    method: 'PUT',
    headers: csrfHeaders(csrf, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ settings, revision: 0 }),
  });
  expect(response.status, await response.clone().text()).toBe(200);
}

const text = () => container.textContent ?? '';
const byId = <T extends HTMLElement>(id: string) => {
  const element = container.querySelector<T>(`#${id}`);
  if (!element) throw new Error(`No element #${id}`);
  return element;
};
function type(id: string, value: string): void {
  const input = byId<HTMLInputElement | HTMLTextAreaElement>(id);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}
function choose(id: string, value: string): void {
  const select = byId<HTMLSelectElement>(id);
  select.value = value;
  select.dispatchEvent(new Event('change'));
}
function pick(group: string, value: string): void {
  byId(group).querySelector<HTMLInputElement>(`input[value="${value}"]`)!.click();
}
function submit(): void {
  container.querySelector<HTMLFormElement>('form.pf-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
}

function fillForm(): void {
  type('pf-student-name', 'Ahmad Contoh');
  type('pf-student-birthPlace', 'Malang');
  type('pf-student-birthDate', `${new Date().getFullYear() - 15}-03-14`);
  pick('pf-student-gender', 'L');
  type('pf-student-nisn', '0012345678');
  type('pf-student-previousSchool', 'SMP Contoh 1');
  for (const [who, nik, year] of [
    ['father', '3507000000000001', '1980'],
    ['mother', '3507000000000002', '1984'],
  ] as const) {
    type(`pf-${who}-name`, who === 'father' ? 'Budi Contoh' : 'Siti Contoh');
    type(`pf-${who}-nik`, nik);
    type(`pf-${who}-birthYear`, year);
    choose(`pf-${who}-education`, 'S1');
    choose(`pf-${who}-job`, 'Swasta / Wiraswasta');
    choose(`pf-${who}-income`, 'Rp1.000.000 – Rp3.000.000');
  }
  type('pf-address', 'Jl. Contoh No. 1, RT 01/RW 02, Desa Contoh, Turen');
  type('pf-postalCode', '65175');
  type('pf-phone', '0812 3456 7890');
  pick('pf-boarding', 'bersedia');
  pick('pf-payment', 'transfer');
}

beforeEach(async () => {
  seed();
  getDatabase().prepare('DELETE FROM ppdb_applications').run();
  getDatabase().prepare('DELETE FROM ppdb_sequences').run();
  getDatabase().prepare('DELETE FROM ppdb_settings').run();
  container = document.createElement('div');
  document.body.append(container);
  application = undefined;
  tabCookie = '';
  pending = new Set();
  committee = await signUp('Panitia PPDB');
  grantRole(committee.id, 'panitia-ppdb');
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PPDB on the public site', () => {
  it('says the form is closed until the committee opens it', async () => {
    await openTab('', '/ppdb?jenjang=smp');
    await until(() => text().includes('Pendaftaran online sedang ditutup.'));
    expect(container.querySelector('form.pf-form')).toBeNull();
  });

  it('registers an SMA student and shows the number with the next steps', async () => {
    await configure((settings) => {
      settings.open = true;
      settings.academicYear = '2027/2028';
      settings.nextSteps.sma = 'Transfer infaq pendaftaran ke rekening sekolah.\nKirim bukti ke panitia.';
      settings.groupLink.sma = 'https://chat.whatsapp.com/ContohGrupSma';
    });
    await openTab('', '/ppdb?jenjang=sma');
    await until(() => container.querySelector('form.pf-form') !== null);
    expect(text()).toContain('Formulir SMA IT Al Bashiroh 2027/2028.');

    // Sending it empty points at what is missing, without a request.
    submit();
    await settle();
    expect(container.querySelector('.pf-notice')?.textContent).toContain('Ada isian yang perlu diperbaiki');
    expect(text()).toContain('NISN berisi 10 angka');
    expect(text()).toContain('NIK ibu berisi 16 angka');
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM ppdb_applications').get()).toEqual({ count: 0 });

    fillForm();
    // A person takes longer than the form's minimum; the clock says so.
    const realNow = Date.now.bind(Date);
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 60_000);
    submit();
    await until(() => text().includes('Pendaftaran terkirim.'));

    expect(container.querySelector('.pf-code b')?.textContent).toMatch(/^SMA-\d{4}-0001$/);
    expect(container.querySelector('.pf-next')?.textContent).toContain('Kirim bukti ke panitia.');
    expect(container.querySelector<HTMLAnchorElement>('a[href="https://chat.whatsapp.com/ContohGrupSma"]')).not.toBeNull();
    const saved = getDatabase().prepare('SELECT level, nisn, phone, status FROM ppdb_applications').get();
    expect(saved).toEqual({ level: 'sma', nisn: '0012345678', phone: '6281234567890', status: 'baru' });

    // A sibling: the family's part stays, the student's is empty again.
    container.querySelector<HTMLButtonElement>('.pf-again')!.click();
    await until(() => container.querySelector('form.pf-form') !== null);
    expect(byId<HTMLInputElement>('pf-student-name').value).toBe('');
    expect(byId<HTMLInputElement>('pf-father-name').value).toBe('Budi Contoh');
  });

  it('marks the NISN when that student already registered for the level', async () => {
    await configure((settings) => {
      settings.open = true;
    });
    await openTab('', '/ppdb?jenjang=smp');
    await until(() => container.querySelector('form.pf-form') !== null);
    fillForm();
    type('pf-student-birthDate', `${new Date().getFullYear() - 12}-03-14`);
    const realNow = Date.now.bind(Date);
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 60_000);
    submit();
    await until(() => text().includes('Pendaftaran terkirim.'));

    container.querySelector<HTMLButtonElement>('.pf-again')!.click();
    await until(() => container.querySelector('form.pf-form') !== null);
    type('pf-student-name', 'Ahmad Contoh');
    type('pf-student-birthPlace', 'Malang');
    type('pf-student-birthDate', `${new Date().getFullYear() - 12}-03-14`);
    pick('pf-student-gender', 'L');
    type('pf-student-nisn', '0012345678');
    type('pf-student-previousSchool', 'SD Contoh 1');
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 120_000);
    submit();
    await until(() => text().includes('NISN ini sudah terdaftar di SMP tahun ajaran ini.'));
    expect(byId('pf-student-nisn').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('PPDB in the admin', () => {
  async function registered(): Promise<string> {
    await configure((settings) => {
      settings.open = true;
    });
    await openTab('', '/ppdb?jenjang=sma');
    await until(() => container.querySelector('form.pf-form') !== null);
    fillForm();
    const realNow = Date.now.bind(Date);
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 60_000);
    submit();
    await until(() => text().includes('Pendaftaran terkirim.'));
    application?.unmount();
    application = undefined;
    container.replaceChildren();
    return (getDatabase().prepare('SELECT id FROM ppdb_applications').get() as { id: string }).id;
  }

  it('lists the registration, links the downloads, and saves a review', async () => {
    const id = await registered();
    await openTab(committee.cookie, '/admin/ppdb');
    await until(() => container.querySelector(`[data-application-id="${id}"]`) !== null);

    const row = container.querySelector(`[data-application-id="${id}"]`)!;
    expect(row.textContent).toContain('Ahmad Contoh');
    expect(row.textContent).toContain('SMP Contoh 1');
    const downloads = [...container.querySelectorAll<HTMLAnchorElement>('.ap-export a')].map((link) => link.getAttribute('href'));
    expect(downloads).toEqual(['/api/ppdb/applications/export?format=xlsx', '/api/ppdb/applications/export?format=csv']);
    expect(container.querySelector('.ap-export-note')?.textContent).toContain('NIK dan NISN tetap utuh');

    row.querySelector<HTMLAnchorElement>('a')!.click();
    await until(() => text().includes('Data calon siswa'));
    expect(router.currentRoute.value.name).toBe('ppdb-applicant');
    expect(text()).toContain('3507000000000002');
    expect(text()).toContain('+62 812-3456-7890');

    const status = [...container.querySelectorAll('select')].find((select) => select.querySelector('option[value="diterima"]'))!;
    status.value = 'diterima';
    status.dispatchEvent(new Event('change'));
    await settle();
    container.querySelector<HTMLFormElement>('form.apl-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(getDatabase().prepare('SELECT status, revision FROM ppdb_applications WHERE id = ?').get(id)).toEqual({ status: 'diterima', revision: 2 });
  });

  it('shows the note another member saved meanwhile, so a second save never drops it unseen', async () => {
    const id = await registered();
    await openTab(committee.cookie, `/admin/ppdb/${id}`);
    await until(() => text().includes('Data calon siswa'));
    // Another member saves a note after this page was opened.
    getDatabase().prepare("UPDATE ppdb_applications SET note = 'Ijazah belum dilampirkan.', revision = revision + 1 WHERE id = ?").run(id);

    const note = container.querySelector<HTMLTextAreaElement>('form.apl-form textarea')!;
    note.value = 'Berkas lengkap.';
    note.dispatchEvent(new Event('input'));
    await settle();
    container.querySelector<HTMLFormElement>('form.apl-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();

    expect(note.value).toBe('Berkas lengkap.');
    expect(text()).toContain('Catatan yang baru disimpan panitia lain: Ijazah belum dilampirkan.');
    expect(getDatabase().prepare('SELECT note FROM ppdb_applications WHERE id = ?').get(id)).toEqual({ note: 'Ijazah belum dilampirkan.' });

    // Saving again is now a choice made with both notes in view; the hint goes once saved.
    container.querySelector<HTMLFormElement>('form.apl-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(getDatabase().prepare('SELECT note, revision FROM ppdb_applications WHERE id = ?').get(id)).toEqual({ note: 'Berkas lengkap.', revision: 3 });
    expect(text()).not.toContain('Catatan yang baru disimpan panitia lain');
  });

  it('keeps the review and delete controls from a committee member who can only read', async () => {
    const id = await registered();
    const reader = await signUp('Pembaca PPDB');
    grantRole(reader.id, 'reader-ppdb', ['ppdb.view']);
    await openTab(reader.cookie, `/admin/ppdb/${id}`);
    await until(() => text().includes('Data calon siswa'));
    expect(container.querySelector('form.apl-form')).toBeNull();
    expect(text()).toContain('Hanya pengurus PPDB yang bisa mengubah status.');
    expect(text()).not.toContain('Hapus data pendaftar');
    expect(text()).not.toContain('Pengaturan formulir');
  });
});
