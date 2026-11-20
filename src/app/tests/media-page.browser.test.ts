/// <reference lib="dom" />
import sharp from 'sharp';
import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.vue';
import router from '../router';
import { app as serverApp } from '../server';
import { useAuthSession } from '../../features/auth/web';
import type { MediaItem } from '../../features/media/web';
import { seed } from '../../shared/database';
import { closeEventStreams } from '../../shared/realtime';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../shared/security/tests/helpers';
import { grantRole, signUp } from './personas';

/**
 * Two people editing one photo's details: the one who saves second sees what
 * the other saved, keeps their own change, and saves on purpose.
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

class QuietEventSource extends EventTarget {
  readyState = 0;
  close(): void {
    this.readyState = 2;
  }
}

async function settle(): Promise<void> {
  for (let round = 0; round < 12; round += 1) {
    if (pending.size > 0) await Promise.allSettled([...pending]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await nextTick();
  }
}

/** A request from another device signed in as `cookie`. */
async function asDevice(cookie: string, path: string, init: { method: string; body?: BodyInit; json?: unknown }): Promise<Response> {
  const state = await issueCsrf(serverApp, cookie);
  const headers = csrfHeaders(state, init.json === undefined ? {} : { 'Content-Type': 'application/json' });
  return serverApp.request(path, { method: init.method, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
}

function field(label: string): HTMLInputElement | HTMLTextAreaElement {
  const box = [...document.querySelectorAll('.ab-field')].find((candidate) => candidate.querySelector('.ab-field-label')?.textContent?.replace(' *', '').trim() === label);
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

describe('media details edited by two people', () => {
  it('takes what the other person saved, keeps this draft, and says where they differ', async () => {
    const me = await signUp('Editor Satu');
    const other = await signUp('Editor Dua');
    for (const person of [me, other]) grantRole(person.id, 'media-editors', ['media.view', 'media.upload']);

    const form = new FormData();
    const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 14, g: 58, b: 39 } } }).jpeg().toBuffer();
    form.append('file', new File([new Uint8Array(jpeg)], 'lapangan.jpg', { type: 'image/jpeg' }));
    const created = await asDevice(other.cookie, '/api/media', { method: 'POST', body: form });
    expect(created.status).toBe(201);
    const item = ((await created.json()) as { data: { item: MediaItem } }).data.item;

    tabCookie = me.cookie;
    await useAuthSession().refresh();
    await router.push('/admin/media');
    await router.isReady();
    const mounted = createApp(App).use(router);
    mounted.mount(container);
    application = mounted;
    await settle();

    container.querySelector<HTMLElement>(`.md-tile`)!.click();
    await settle();
    type(field('Nama'), 'Lapangan versi saya');

    // Meanwhile the other editor renames it and describes it.
    const theirs = await asDevice(other.cookie, `/api/media/${item.id}`, { method: 'PATCH', json: { name: 'Lapangan versi dia', alt: 'Siswa upacara di lapangan', revision: item.revision } });
    expect(theirs.status).toBe(200);

    document.querySelector<HTMLFormElement>('#md-edit')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();

    expect(field('Nama').value).toBe('Lapangan versi saya');
    expect(field('Keterangan gambar').value).toBe('Siswa upacara di lapangan');
    const nameBox = field('Nama').closest('.ab-field')!;
    expect(nameBox.querySelector('.ab-field-hint')?.textContent).toBe('Versi yang baru disimpan orang lain: Lapangan versi dia');
    expect(field('Keterangan gambar').closest('.ab-field')!.querySelector('.ab-field-hint')?.textContent).not.toContain('orang lain');

    // Saving again is a choice made with both versions in view.
    document.querySelector<HTMLFormElement>('#md-edit')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    const stored = (await (await serverApp.request(`/api/media?limit=5`, { headers: { Cookie: me.cookie } })).json()) as { data: { items: MediaItem[] } };
    expect(stored.data.items[0]).toMatchObject({ name: 'Lapangan versi saya', alt: 'Siswa upacara di lapangan', revision: 3 });
  });
});
