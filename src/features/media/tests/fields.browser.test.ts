/// <reference lib="dom" />
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AbToaster } from '../../../shared/ui';
import { MediaFileField, MediaImageField, MediaThumb, provideMediaClient, type MediaClient, type MediaItem } from '../web';

/**
 * The photo and document fields with a stand-in library client: what a form
 * shows with nothing chosen, after an upload, and when a chosen photo was
 * deleted from the library since.
 */
let container: HTMLDivElement;
let unmount: (() => void) | undefined;

const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'image',
  name: 'Lapangan',
  alt: '',
  mimeType: 'image/webp',
  size: 2048,
  width: 1600,
  height: 900,
  url: '/media/11111111-1111-4111-8111-111111111111/md.webp',
  variants: null,
  createdAt: 0,
  updatedAt: 0,
  revision: 1,
  ...over,
});

function fakeClient(overrides: Partial<MediaClient> = {}): MediaClient {
  return {
    list: vi.fn(async () => ({ ok: true as const, status: 200, message: 'OK', data: { items: [], total: 0, page: 1, limit: 24 } })),
    upload: vi.fn(async () => ({ ok: true as const, status: 201, message: 'Uploaded', data: { item: item() } })),
    update: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  } as MediaClient;
}

function mount(client: MediaClient, render: () => ReturnType<typeof h>): void {
  const app = createApp(
    defineComponent({
      setup() {
        provideMediaClient(client);
        return render;
      },
    }),
  );
  app.mount(container);
  unmount = () => app.unmount();
}

const settle = async () => {
  for (let index = 0; index < 4; index += 1) await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function chooseFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  container.remove();
  for (const layer of document.querySelectorAll('.ab-dialog-layer')) layer.remove();
});

describe('MediaImageField', () => {
  it('asks for a picture when there is none, and holds the uploaded one', async () => {
    const value = ref<string | null>(null);
    const client = fakeClient();
    mount(client, () => h(MediaImageField, { label: 'Foto sampul', modelValue: value.value, 'onUpdate:modelValue': (next: string | null) => (value.value = next) }));
    await settle();

    const empty = container.querySelector('[data-testid="image-empty"]')!;
    expect(empty.textContent).toContain('Belum ada gambar, unggah sekarang');
    expect(container.querySelector('img')).toBeNull();

    chooseFile(container.querySelector('input[type="file"]')!, new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
    await settle();
    expect(client.upload).toHaveBeenCalledOnce();
    expect(value.value).toBe(item().id);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(`/media/${item().id}/md.webp`);
    expect(container.querySelector('[data-testid="image-empty"]')).toBeNull();
  });

  it('shows the empty state again when the chosen photo was deleted from the library', async () => {
    mount(fakeClient(), () => h(MediaImageField, { label: 'Foto', modelValue: item().id }));
    await settle();
    container.querySelector('img')!.dispatchEvent(new Event('error'));
    await settle();
    const empty = container.querySelector('[data-testid="image-empty"]')!;
    expect(empty.textContent).toContain('Belum ada gambar, unggah sekarang');
    expect(empty.textContent).toContain('sudah dihapus dari pustaka');
  });

  it('keeps the field empty and says why when an upload is refused', async () => {
    const value = ref<string | null>(null);
    const client = fakeClient({
      upload: vi.fn(async () => ({ ok: false as const, status: 400, code: 'INVALID_FILE_TYPE', message: 'Only photos' })),
    });
    // Refusals show as a toast; the page's toaster draws them.
    mount(client, () => h('div', [h(MediaImageField, { label: 'Foto', modelValue: value.value, 'onUpdate:modelValue': (next: string | null) => (value.value = next) }), h(AbToaster)]));
    await settle();
    chooseFile(container.querySelector('input[type="file"]')!, new File(['x'], 'a.gif', { type: 'image/gif' }));
    await settle();
    expect(value.value).toBeNull();
    expect(document.body.textContent).toContain('Jenis berkas tidak didukung');
  });

  it('opens the library and takes the chosen photo', async () => {
    const value = ref<string | null>(null);
    const stored = item({ id: '22222222-2222-4222-8222-222222222222', name: 'Asrama' });
    const client = fakeClient({ list: vi.fn(async () => ({ ok: true as const, status: 200, message: 'OK', data: { items: [stored], total: 1, page: 1, limit: 24 } })) });
    mount(client, () => h(MediaImageField, { label: 'Foto', modelValue: value.value, 'onUpdate:modelValue': (next: string | null) => (value.value = next) }));
    await settle();
    [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Pilih dari pustaka'))!.click();
    await settle();
    expect(client.list).toHaveBeenCalledWith(expect.objectContaining({ kind: 'image' }));
    (document.querySelector(`[data-media-id="${stored.id}"]`) as HTMLButtonElement).click();
    await settle();
    expect(value.value).toBe(stored.id);
  });
});

describe('MediaFileField', () => {
  it('asks for a document when there is none and names the one uploaded', async () => {
    const value = ref<string | null>(null);
    const client = fakeClient({
      upload: vi.fn(async () => ({ ok: true as const, status: 201, message: 'Uploaded', data: { item: item({ kind: 'file', name: 'Brosur.pdf', size: 3 * 1024 * 1024 }) } })),
    });
    mount(client, () => h(MediaFileField, { label: 'Berkas', modelValue: value.value, 'onUpdate:modelValue': (next: string | null) => (value.value = next) }));
    await settle();
    expect(container.querySelector('[data-testid="file-empty"]')!.textContent).toContain('Belum ada berkas, unggah sekarang');
    chooseFile(container.querySelector('input[type="file"]')!, new File(['%PDF'], 'Brosur.pdf', { type: 'application/pdf' }));
    await settle();
    expect(value.value).toBe(item().id);
    expect(container.textContent).toContain('Brosur.pdf');
    expect(container.textContent).toContain('3,0 MB');
  });
});

describe('MediaThumb', () => {
  it('marks a record with no picture instead of drawing a broken image', async () => {
    mount(fakeClient(), () => h('div', [h(MediaThumb, { id: null }), h(MediaThumb, { id: item().id, size: 40 })]));
    await settle();
    const [first, second] = container.querySelectorAll('.mt');
    expect(first!.querySelector('[data-testid="thumb-empty"]')!.textContent).toContain('Belum ada gambar');
    second!.querySelector('img')!.dispatchEvent(new Event('error'));
    await settle();
    expect(second!.querySelector('[data-testid="thumb-empty"]')).not.toBeNull();
  });
});
