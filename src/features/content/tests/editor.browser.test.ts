/// <reference lib="dom" />
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideMediaClient, type MediaClient, type MediaItem } from '../../media/web';
// The component itself: the boundary hands pages a lazily loaded copy of it.
import RichTextEditor from '../web/components/RichTextEditor.vue';

/**
 * The article editor with a stand-in library: what it holds, what its
 * toolbar does, and the photo it inserts from the library.
 */
let container: HTMLDivElement;
let unmount: (() => void) | undefined;

const PHOTO: MediaItem = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'image',
  name: 'Upacara',
  alt: 'Siswa berbaris',
  mimeType: 'image/webp',
  size: 2048,
  width: 1600,
  height: 900,
  url: '/media/11111111-1111-4111-8111-111111111111/md.webp',
  variants: null,
  createdAt: 0,
  updatedAt: 0,
  revision: 1,
};

function client(): MediaClient {
  return {
    list: vi.fn(async () => ({ ok: true as const, status: 200, message: 'OK', data: { items: [PHOTO], total: 1, page: 1, limit: 24 } })),
    upload: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  } as unknown as MediaClient;
}

const settle = async () => {
  for (let index = 0; index < 4; index += 1) await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const editorRef = ref<{ editor: { commands: { selectAll(): boolean; focus(position: 'start'): boolean } } | undefined } | null>(null);

function mount(initial: string) {
  const value = ref(initial);
  const app = createApp(
    defineComponent({
      setup() {
        provideMediaClient(client());
        return () => h(RichTextEditor, { ref: editorRef, label: 'Isi berita', modelValue: value.value, 'onUpdate:modelValue': (next: string) => (value.value = next) });
      },
    }),
  );
  app.mount(container);
  unmount = () => app.unmount();
  return value;
}

const tool = (key: string) => container.querySelector<HTMLButtonElement>(`[data-tool="${key}"]`)!;

// jsdom lays nothing out; ProseMirror measures the selection to scroll it into view.
const NO_RECT = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) } as DOMRect;
for (const target of [Range.prototype, Element.prototype] as Array<{ getClientRects?: unknown; getBoundingClientRect?: unknown }>) {
  target.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
  target.getBoundingClientRect ??= () => NO_RECT;
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

describe('RichTextEditor', () => {
  it('shows what it holds under a labelled toolbar', async () => {
    mount('<h2>Upacara</h2><p>Siswa <strong>berbaris</strong>.</p>');
    await settle();
    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Format Isi berita');
    const content = container.querySelector('.rte-content')!;
    expect(content.getAttribute('role')).toBe('textbox');
    expect(content.querySelector('h2')?.textContent).toBe('Upacara');
    expect(content.querySelector('strong')?.textContent).toBe('berbaris');
  });

  it('turns the current paragraph into a heading and back', async () => {
    const value = mount('<p>Kegiatan</p>');
    await settle();
    tool('h2').click();
    await settle();
    expect(value.value).toBe('<h2>Kegiatan</h2>');
    expect(tool('h2').getAttribute('aria-pressed')).toBe('true');
    // Back in the heading, as an editor clicking into it would be.
    editorRef.value!.editor!.commands.focus('start');
    tool('paragraph').click();
    await settle();
    expect(value.value).toBe('<p>Kegiatan</p>');
  });

  it('inserts a photo from the library at its medium width', async () => {
    const value = mount('<p>Foto kegiatan:</p>');
    await settle();
    tool('image').click();
    await settle();
    (document.querySelector(`[data-media-id="${PHOTO.id}"]`) as HTMLButtonElement).click();
    await settle();
    expect(value.value).toContain(`<img src="/media/${PHOTO.id}/md.webp" alt="Siswa berbaris">`);
  });

  it('sets a link from its own bar, adding https:// when left out', async () => {
    const value = mount('<p>Kemdikbud</p>');
    await settle();
    // Select the word, as an editor would before pressing the link button.
    editorRef.value!.editor!.commands.selectAll();
    await settle();
    tool('link').click();
    await settle();
    const input = container.querySelector<HTMLInputElement>('.rte-link input')!;
    input.value = 'kemdikbud.go.id';
    input.dispatchEvent(new Event('input'));
    container.querySelector<HTMLFormElement>('.rte-link')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(value.value).toContain('href="https://kemdikbud.go.id"');
    expect(container.querySelector('.rte-link')).toBeNull();
  });

  it('reports an empty editor as empty text', async () => {
    const value = mount('<p>Hapus saya</p>');
    await settle();
    value.value = '';
    await settle();
    expect(container.querySelector('.rte-content p.is-editor-empty')).not.toBeNull();
    expect(value.value).toBe('');
  });
});
