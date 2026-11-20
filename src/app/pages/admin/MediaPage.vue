<script setup lang="ts">
import { FileText, Images, Upload } from 'lucide-vue-next';
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { useAuthSession } from '../../../features/auth/web';
import {
  FILE_ACCEPT,
  formatBytes,
  imageUrl,
  MEDIA_CHANGED_EVENT,
  mediaRefusalText,
  type MediaItem,
  type MediaKind,
} from '../../../features/media/web';
import { onServerEvent } from '../../../shared/realtime/browser';
import { AbButton, AbCard, AbCopy, AbDialog, AbEmpty, AbField, AbNotice, AbPage, AbSearch, AbSpinner, dateTimeShort, showToast } from '../../../shared/ui';
import { mergeStale } from '../../account';
import { mediaClient } from '../../cms';

/**
 * Media: every photo and document uploaded for the site. Photos are stored
 * as WebP in three widths; this page uploads, describes and removes them.
 */
const session = useAuthSession();
const canUpload = computed(() => session.can('media.upload'));
const canDelete = computed(() => session.can('media.delete'));

const FILTERS: { value: MediaKind | ''; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'image', label: 'Foto' },
  { value: 'file', label: 'Dokumen' },
];
const kind = ref<MediaKind | ''>('');
const query = ref('');
const term = ref('');
let pause: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(pause);
  pause = setTimeout(() => (term.value = value.trim()), 250);
});

const items = ref<MediaItem[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const error = ref<string | null>(null);
let ticket = 0;

async function load(reset = true): Promise<void> {
  const mine = ++ticket;
  loading.value = true;
  const next = reset ? 1 : page.value + 1;
  const result = await mediaClient.list({ page: next, limit: 36, kind: kind.value || undefined, q: term.value || undefined });
  if (mine !== ticket) return;
  loading.value = false;
  if (!result.ok) {
    error.value = mediaRefusalText(result);
    return;
  }
  error.value = null;
  page.value = next;
  total.value = result.data.total;
  items.value = reset ? result.data.items : [...items.value, ...result.data.items];
}
watch([kind, term], () => void load());
void load();
onUnmounted(onServerEvent(MEDIA_CHANGED_EVENT, () => void load()));
onUnmounted(() => clearTimeout(pause));

// Several files at once go up one after another, so a phone on a slow line
// is not asked to send them all together.
const picker = ref<HTMLInputElement>();
const uploading = ref<{ done: number; count: number } | null>(null);
async function upload(event: Event): Promise<void> {
  const files = [...((event.target as HTMLInputElement).files ?? [])];
  (event.target as HTMLInputElement).value = '';
  if (files.length === 0) return;
  uploading.value = { done: 0, count: files.length };
  let failed = 0;
  for (const file of files) {
    const result = await mediaClient.upload(file);
    if (!result.ok) {
      failed += 1;
      showToast(`${file.name}: ${mediaRefusalText(result)}`, 'bad');
    }
    uploading.value = { done: uploading.value.done + 1, count: files.length };
  }
  uploading.value = null;
  const stored = files.length - failed;
  if (stored > 0) showToast(stored === 1 ? 'Berkas diunggah' : `${stored} berkas diunggah`, 'good');
  await load();
}

// One item: its preview, name and description, address, and removal.
const open = ref<MediaItem | null>(null);
const draft = reactive({ name: '', alt: '' });
const nameError = ref<string>();
const saving = ref(false);
/** What someone else saved while this was open, shown under each field this draft still differs on. */
const theirs = ref<{ name: string; alt: string } | null>(null);
function show(item: MediaItem): void {
  open.value = item;
  Object.assign(draft, { name: item.name, alt: item.alt });
  nameError.value = undefined;
  theirs.value = null;
}
const theirNote = (key: 'name' | 'alt') =>
  theirs.value && theirs.value[key] !== draft[key] ? `Versi yang baru disimpan orang lain: ${theirs.value[key] || '(kosong)'}` : undefined;
const address = computed(() => (open.value ? new URL(open.value.variants?.lg ?? open.value.url, window.location.origin).href : ''));

async function save(): Promise<void> {
  if (!open.value) return;
  nameError.value = draft.name.trim() ? undefined : 'Isi nama berkas.';
  if (nameError.value) return;
  saving.value = true;
  const result = await mediaClient.update(open.value.id, { name: draft.name.trim(), alt: draft.alt.trim(), revision: open.value.revision });
  saving.value = false;
  if (result.ok) {
    showToast('Tersimpan', 'good');
    open.value = null;
    return;
  }
  if (result.code === 'STALE_REVISION' && result.current) {
    // Someone else saved first: take what they changed, keep what this draft changed, and show where the two differ.
    const current = result.current as MediaItem;
    const saved = { name: current.name, alt: current.alt };
    Object.assign(draft, mergeStale({ name: open.value.name, alt: open.value.alt }, { ...draft }, saved));
    theirs.value = saved;
    open.value = current;
    showToast('Berkas ini baru diubah orang lain. Periksa lalu simpan lagi.', 'warn');
    return;
  }
  showToast(mediaRefusalText(result), 'bad');
}

const removing = ref(false);
const confirmRemove = ref(false);
async function remove(): Promise<void> {
  if (!open.value) return;
  removing.value = true;
  const result = await mediaClient.remove(open.value.id);
  removing.value = false;
  if (!result.ok) {
    showToast(mediaRefusalText(result), 'bad');
    return;
  }
  confirmRemove.value = false;
  open.value = null;
  showToast('Berkas dihapus', 'good');
}
</script>

<template>
  <AbPage title="Media" description="Foto dan dokumen yang dipakai di seluruh situs. Foto otomatis dikecilkan agar halaman cepat dibuka.">
    <template v-if="canUpload" #actions>
      <input ref="picker" class="ab-visually-hidden" type="file" multiple :accept="FILE_ACCEPT" tabindex="-1" aria-hidden="true" @change="upload" />
      <AbButton :loading="uploading !== null" @click="picker?.click()">
        <Upload :size="18" />{{ uploading ? `Mengunggah ${uploading.done + 1} dari ${uploading.count}` : 'Unggah berkas' }}
      </AbButton>
    </template>

    <AbCard>
      <div class="md-tools">
        <div class="md-filter" role="radiogroup" aria-label="Jenis berkas">
          <button
            v-for="option in FILTERS"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="kind === option.value"
            class="md-filter-option"
            :class="{ 'is-on': kind === option.value }"
            @click="kind = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <AbSearch v-model="query" placeholder="Cari nama atau keterangan" label="Cari media" />
      </div>

      <AbNotice v-if="error" tone="bad">
        {{ error }}
        <AbButton variant="outline" size="sm" @click="load()">Coba lagi</AbButton>
      </AbNotice>
      <div v-else-if="loading && items.length === 0" class="md-state"><AbSpinner /></div>
      <AbEmpty
        v-else-if="items.length === 0"
        :icon="Images"
        :title="term ? 'Tidak ada yang cocok' : 'Belum ada media'"
        :text="term ? 'Coba kata lain.' : 'Foto dan dokumen yang diunggah untuk berita, galeri, guru dan lainnya tampil di sini.'"
      />
      <ul v-else class="md-grid" aria-label="Media">
        <li v-for="item in items" :key="item.id">
          <button type="button" class="md-tile" :data-media-id="item.id" @click="show(item)">
            <img v-if="item.kind === 'image'" :src="imageUrl(item.id, 'sm')" :alt="item.alt" loading="lazy" decoding="async" />
            <span v-else class="md-doc"><FileText :size="34" /><span>{{ item.name.split('.').pop()?.toUpperCase() }}</span></span>
            <span class="md-tile-text">
              <b>{{ item.name }}</b>
              <span>{{ item.kind === 'image' ? `${item.width} × ${item.height}` : formatBytes(item.size) }}</span>
            </span>
          </button>
        </li>
      </ul>
      <div v-if="items.length < total" class="md-more">
        <AbButton variant="outline" :loading="loading" @click="load(false)">Muat lebih banyak</AbButton>
      </div>
    </AbCard>

    <AbDialog :open="open !== null" :title="open?.kind === 'image' ? 'Detail foto' : 'Detail dokumen'" size="lg" @close="open = null">
      <div v-if="open" class="md-detail">
        <img v-if="open.kind === 'image'" class="md-detail-preview" :src="imageUrl(open.id, 'lg')" :alt="open.alt" />
        <a v-else class="md-detail-doc" :href="open.url" target="_blank" rel="noopener"><FileText :size="40" />Buka dokumen</a>
        <form id="md-edit" class="md-detail-form" @submit.prevent="save">
          <AbField v-model="draft.name" label="Nama" :error="nameError" :hint="theirNote('name')" :disabled="!canUpload" />
          <AbField
            v-if="open.kind === 'image'"
            v-model="draft.alt"
            label="Keterangan gambar"
            :hint="theirNote('alt') ?? 'Gambarkan isi foto dalam satu kalimat, untuk pembaca layar dan mesin pencari.'"
            multiline
            :rows="2"
            :disabled="!canUpload"
          />
          <dl class="md-facts">
            <div><dt>Ukuran</dt><dd>{{ open.kind === 'image' ? `${open.width} × ${open.height} piksel, ` : '' }}{{ formatBytes(open.size) }}</dd></div>
            <div><dt>Diunggah</dt><dd>{{ dateTimeShort(open.createdAt) }}</dd></div>
          </dl>
          <AbCopy :text="address" label="Salin alamat berkas" block />
        </form>
      </div>
      <template #footer>
        <AbButton v-if="canDelete" variant="danger" class="md-delete" @click="confirmRemove = true">Hapus</AbButton>
        <AbButton variant="outline" :disabled="saving" @click="open = null">{{ canUpload ? 'Batal' : 'Tutup' }}</AbButton>
        <AbButton v-if="canUpload" type="submit" form="md-edit" :loading="saving">Simpan</AbButton>
      </template>
    </AbDialog>

    <AbDialog :open="confirmRemove" title="Hapus berkas ini?" size="sm" :persistent="removing" @close="confirmRemove = false">
      <p class="md-warning">
        Halaman yang memakai berkas ini akan menampilkan sampul polos (foto) atau tanpa tautan unduhan (dokumen) sampai diganti. Tindakan ini tidak bisa dibatalkan.
      </p>
      <template #footer>
        <AbButton variant="outline" :disabled="removing" @click="confirmRemove = false">Batal</AbButton>
        <AbButton variant="danger" :loading="removing" @click="remove">Hapus</AbButton>
      </template>
    </AbDialog>
  </AbPage>
</template>

<style scoped>
.md-tools { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 18px; }
.md-tools > :last-child { flex: 1 1 240px; }
.md-filter { display: inline-flex; padding: 4px; border-radius: 12px; background: var(--ab-paper-2); }
.md-filter-option { padding: 8px 14px; border-radius: 9px; color: var(--ab-ink-2); font-size: 14px; font-weight: 700; }
.md-filter-option.is-on { background: var(--ab-forest); color: #fff; }
.md-state { display: grid; place-items: center; padding: 56px 0; }
.md-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 14px; margin: 0; padding: 0; list-style: none; }
.md-tile {
  display: block;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--ab-line);
  border-radius: 16px;
  background: var(--ab-card);
  text-align: left;
}
.md-tile:hover, .md-tile:focus-visible { border-color: var(--ab-forest); }
.md-tile img, .md-doc { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: var(--ab-paper-2); }
.md-doc { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: var(--ab-forest); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .1em; }
.md-tile-text { display: grid; padding: 10px 12px 12px; }
.md-tile-text b { overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.md-tile-text span { color: var(--ab-mute); font-size: 12.5px; }
.md-more { display: flex; justify-content: center; margin-top: 18px; }
.md-detail { display: grid; gap: 18px; }
.md-detail-preview { display: block; width: 100%; max-height: 52vh; border-radius: 14px; background: var(--ab-paper-2); object-fit: contain; }
.md-detail-doc { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 28px; border-radius: 14px; background: var(--ab-forest); color: #fff; font-weight: 800; }
.md-detail-form { display: grid; gap: 14px; }
.md-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin: 0; }
.md-facts dt { color: var(--ab-mute); font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.md-facts dd { margin: 2px 0 0; font-size: 14.5px; font-weight: 600; }
.md-delete { margin-right: auto; }
.md-warning { margin: 0; color: var(--ab-ink-2); }
@media (max-width: 719px) {
  .md-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
}
</style>
