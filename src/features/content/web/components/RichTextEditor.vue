<script setup lang="ts">
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, ref, useId, watch, type Component } from 'vue';
import { imageUrl, MediaPicker, type MediaItem } from '../../../media/web';

/**
 * The article editor: headings, emphasis, lists, quotes, links and photos
 * from the library, in the site's own look. It holds HTML; the server keeps
 * only what this toolbar can make, so pasted styles and scripts never reach a
 * page.
 */
const props = withDefaults(
  defineProps<{ label: string; modelValue: string; placeholder?: string; hint?: string; error?: string; disabled?: boolean; compact?: boolean }>(),
  { placeholder: 'Tulis di sini…' },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const id = useId();
const empty = (html: string) => html === '' || html === '<p></p>';
// The editor keeps an empty paragraph after a heading or photo so the cursor can go there; the saved text does not.
const normalize = (html: string) => (empty(html) ? '' : html.replace(/(<p><\/p>)+$/, ''));

const editor = useEditor({
  content: props.modelValue,
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer' } },
    }),
    Image.configure({ inline: false }),
    Placeholder.configure({ placeholder: () => props.placeholder }),
  ],
  editorProps: {
    attributes: {
      class: 'rte-content ab-prose',
      'aria-multiline': 'true',
      role: 'textbox',
      'aria-labelledby': `${id}-label`,
      ...(props.hint || props.error ? { 'aria-describedby': `${id}-note` } : {}),
    },
  },
  onUpdate: ({ editor: current }) => {
    emit('update:modelValue', normalize(current.getHTML()));
  },
});

watch(
  () => props.modelValue,
  (value) => {
    const current = editor.value;
    if (!current) return;
    if (normalize(value) === normalize(current.getHTML())) return;
    current.commands.setContent(value, { emitUpdate: false });
  },
);
watch(
  () => props.disabled,
  (disabled) => editor.value?.setEditable(!disabled),
);
onBeforeUnmount(() => editor.value?.destroy());
defineExpose({ editor });

// The toolbar. `active` lights a button while the cursor sits in what it makes.
interface Tool {
  key: string;
  label: string;
  icon: Component;
  run: () => void;
  active?: () => boolean;
  disabled?: () => boolean;
}
const chain = () => editor.value!.chain().focus();
const is = (name: string, attributes?: Record<string, unknown>) => editor.value?.isActive(name, attributes) ?? false;

const groups = computed<Tool[][]>(() => [
  [
    { key: 'paragraph', label: 'Paragraf', icon: Pilcrow, run: () => chain().setParagraph().run(), active: () => is('paragraph') },
    { key: 'h2', label: 'Judul bagian', icon: Heading2, run: () => chain().toggleHeading({ level: 2 }).run(), active: () => is('heading', { level: 2 }) },
    { key: 'h3', label: 'Subjudul', icon: Heading3, run: () => chain().toggleHeading({ level: 3 }).run(), active: () => is('heading', { level: 3 }) },
  ],
  [
    { key: 'bold', label: 'Tebal', icon: Bold, run: () => chain().toggleBold().run(), active: () => is('bold') },
    { key: 'italic', label: 'Miring', icon: Italic, run: () => chain().toggleItalic().run(), active: () => is('italic') },
    { key: 'underline', label: 'Garis bawah', icon: Underline, run: () => chain().toggleUnderline().run(), active: () => is('underline') },
    { key: 'strike', label: 'Coret', icon: Strikethrough, run: () => chain().toggleStrike().run(), active: () => is('strike') },
  ],
  [
    { key: 'bullet', label: 'Daftar berpoin', icon: List, run: () => chain().toggleBulletList().run(), active: () => is('bulletList') },
    { key: 'ordered', label: 'Daftar bernomor', icon: ListOrdered, run: () => chain().toggleOrderedList().run(), active: () => is('orderedList') },
    { key: 'quote', label: 'Kutipan', icon: Quote, run: () => chain().toggleBlockquote().run(), active: () => is('blockquote') },
    { key: 'rule', label: 'Garis pemisah', icon: Minus, run: () => chain().setHorizontalRule().run() },
  ],
  [
    { key: 'link', label: 'Tautan', icon: Link2, run: () => openLink(), active: () => is('link') },
    { key: 'image', label: 'Gambar dari pustaka', icon: ImagePlus, run: () => (picking.value = true) },
  ],
  [
    { key: 'undo', label: 'Urungkan', icon: Undo2, run: () => chain().undo().run(), disabled: () => !editor.value?.can().undo() },
    { key: 'redo', label: 'Ulangi', icon: Redo2, run: () => chain().redo().run(), disabled: () => !editor.value?.can().redo() },
  ],
]);

// Links are edited in a small bar under the toolbar, never a browser prompt.
const linking = ref(false);
const linkHref = ref('');
const linkInput = ref<HTMLInputElement>();
async function openLink(): Promise<void> {
  linkHref.value = (editor.value?.getAttributes('link').href as string | undefined) ?? '';
  linking.value = true;
  await nextTick();
  linkInput.value?.focus();
}
function saveLink(): void {
  const href = linkHref.value.trim();
  if (!href) chain().extendMarkRange('link').unsetLink().run();
  else chain().extendMarkRange('link').setLink({ href: /^(https?:|mailto:|tel:|\/)/i.test(href) ? href : `https://${href}` }).run();
  linking.value = false;
}
function removeLink(): void {
  chain().extendMarkRange('link').unsetLink().run();
  linking.value = false;
}

const picking = ref(false);
function insertImage(item: MediaItem): void {
  picking.value = false;
  chain().setImage({ src: imageUrl(item.id, 'md'), alt: item.alt || item.name }).run();
}
</script>

<template>
  <div class="rte" :class="{ 'rte--bad': error, 'rte--off': disabled, 'rte--compact': compact }">
    <span :id="`${id}-label`" class="rte-label">{{ label }}</span>
    <div class="rte-frame">
      <div class="rte-bar" role="toolbar" :aria-label="`Format ${label}`">
        <div v-for="(group, index) in groups" :key="index" class="rte-group">
          <button
            v-for="tool in group"
            :key="tool.key"
            type="button"
            class="rte-tool"
            :class="{ 'is-on': tool.active?.() }"
            :aria-pressed="tool.active ? tool.active() : undefined"
            :aria-label="tool.label"
            :title="tool.label"
            :data-tool="tool.key"
            :disabled="disabled || !editor || tool.disabled?.()"
            @mousedown.prevent
            @click="tool.run()"
          >
            <component :is="tool.icon" :size="17" :stroke-width="2.25" aria-hidden="true" />
          </button>
        </div>
      </div>
      <!-- novalidate: a bare address ("albashiroh.sch.id") is fine here; saveLink adds its https://. -->
      <form v-if="linking" class="rte-link" novalidate @submit.prevent="saveLink">
        <label class="ab-visually-hidden" :for="`${id}-link`">Alamat tautan</label>
        <input :id="`${id}-link`" ref="linkInput" v-model="linkHref" type="url" inputmode="url" placeholder="https://…" @keydown.esc.prevent="linking = false" />
        <button type="submit" class="rte-link-save">Pasang</button>
        <button v-if="is('link')" type="button" class="rte-link-plain" @click="removeLink">Lepas</button>
        <button type="button" class="rte-link-plain" @click="linking = false">Batal</button>
      </form>
      <EditorContent :editor="editor" class="rte-body" />
    </div>
    <p v-if="error || hint" :id="`${id}-note`" class="rte-note" :class="{ 'rte-note--bad': error }">{{ error ?? hint }}</p>
    <MediaPicker :open="picking" kind="image" title="Sisipkan gambar" @close="picking = false" @select="insertImage" />
  </div>
</template>

<style scoped>
.rte { display: grid; gap: 8px; }
.rte-label { font-size: 14.5px; font-weight: 700; }
.rte-frame { overflow: hidden; border: 1.5px solid var(--ab-line-strong); border-radius: var(--ab-radius); background: var(--ab-card); }
.rte-frame:focus-within { border-color: var(--ab-forest); box-shadow: var(--ab-focus); }
.rte--bad .rte-frame { border-color: var(--ab-red); }
.rte-bar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  padding: 8px;
  background: var(--ab-forest);
}
.rte-group { display: flex; gap: 2px; }
.rte-group + .rte-group { padding-left: 10px; border-left: 1px solid rgba(255, 255, 255, .16); }
.rte-tool {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 9px;
  color: rgba(255, 255, 255, .86);
}
.rte-tool:hover:not(:disabled) { background: rgba(255, 255, 255, .12); color: #fff; }
.rte-tool.is-on { background: var(--ab-sun); color: var(--ab-forest); }
.rte-tool:disabled { opacity: .38; }
.rte-tool:focus-visible { outline: 2px solid var(--ab-sun); outline-offset: 1px; }
.rte-link { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px; border-bottom: 1px solid var(--ab-line); background: var(--ab-sun-soft); }
.rte-link input { flex: 1 1 220px; min-width: 0; height: 38px; padding: 0 12px; border: 1.5px solid var(--ab-line-strong); border-radius: 10px; background: #fff; font: inherit; }
.rte-link input:focus { border-color: var(--ab-forest); outline: none; box-shadow: var(--ab-focus); }
.rte-link-save { height: 38px; padding: 0 14px; border-radius: 10px; background: var(--ab-forest); color: #fff; font-weight: 800; }
.rte-link-plain { height: 38px; padding: 0 10px; border-radius: 10px; color: var(--ab-ink-2); font-weight: 700; }
.rte-body :deep(.rte-content) { min-height: 260px; max-height: 70vh; overflow-y: auto; padding: 18px 20px; outline: none; }
.rte--compact .rte-body :deep(.rte-content) { min-height: 150px; }
.rte--off .rte-body :deep(.rte-content) { background: var(--ab-paper-2); color: var(--ab-mute); }
.rte-body :deep(p.is-editor-empty:first-child::before) { float: left; height: 0; color: var(--ab-faint); content: attr(data-placeholder); pointer-events: none; }
.rte-body :deep(img.ProseMirror-selectednode) { outline: 3px solid var(--ab-sun); }
.rte-note { margin: 0; color: var(--ab-mute); font-size: 13px; }
.rte-note--bad { color: var(--ab-red); font-weight: 600; }
@media (max-width: 719px) {
  .rte-bar { gap: 4px 6px; padding: 6px; }
  .rte-group + .rte-group { padding-left: 6px; }
  .rte-body :deep(.rte-content) { padding: 14px; }
}
</style>
