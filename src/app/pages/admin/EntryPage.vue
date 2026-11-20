<script setup lang="ts">
import { ExternalLink, History, Trash2 } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import {
  contentRefusalText,
  contentType,
  fieldError,
  PORTAL_INFO,
  RichTextEditor,
  type ContentEntry,
  type ContentType,
  type EntryInput,
  type EntryStatus,
  type Portal,
} from '../../../features/content/web';
import { MediaFileField, MediaImageField } from '../../../features/media/web';
import { AbButton, AbCard, AbDialog, AbEmpty, AbField, AbNotice, AbPage, AbSpinner, dateTimeShort, dayWib, showToast } from '../../../shared/ui';
import { mergeStale } from '../../account';
import { contentClient } from '../../cms';
import { portalRoute } from '../../content-admin';

/**
 * Writing or editing one entry. The form shows only the parts its type has;
 * saving checks against the version that was opened, so two editors never
 * overwrite each other unknowingly.
 */
const props = defineProps<{ portal: Portal; type: string; id: string | null }>();
const router = useRouter();

const def = computed(() => contentType(props.type));
const kind = computed(() => props.type as ContentType);
const routes = computed(() => portalRoute(props.portal));
const has = (part: 'summary' | 'body' | 'image' | 'file' | 'date') => Boolean(def.value && part in def.value);
const partLabel = (part: 'summary' | 'body' | 'image' | 'file' | 'date') => (def.value as Record<string, unknown> | undefined)?.[part] as string;

type Draft = Required<EntryInput>;
const blank = (): Draft => ({ title: '', slug: '', summary: '', body: '', imageId: null, fileId: null, date: null, fields: {}, status: 'draft' });
const fromEntry = (entry: ContentEntry): Draft => ({
  title: entry.title,
  slug: entry.slug,
  summary: entry.summary,
  body: entry.body,
  imageId: entry.imageId,
  fileId: entry.fileId,
  date: entry.date,
  fields: { ...entry.fields },
  status: entry.status,
});

const entry = ref<ContentEntry | null>(null);
const draft = reactive<Draft>(blank());
// What the form was filled from: the base for "unsaved changes" and for merging a stale save.
const opened = ref<Draft>(blank());
const loading = ref(false);
const loadError = ref<string | null>(null);
const errors = ref<Record<string, string[]>>();
const saving = ref(false);

function fill(next: Draft): void {
  Object.assign(draft, structuredClone(next));
  opened.value = structuredClone(next);
}

async function load(): Promise<void> {
  errors.value = undefined;
  if (!def.value) return;
  if (!props.id) {
    entry.value = null;
    fill(blank());
    return;
  }
  loading.value = true;
  const result = await contentClient.get(props.portal, kind.value, props.id);
  loading.value = false;
  if (!result.ok) {
    loadError.value = contentRefusalText(result);
    return;
  }
  loadError.value = null;
  entry.value = result.data.entry;
  fill(fromEntry(result.data.entry));
}
watch(() => [props.portal, props.type, props.id], () => void load(), { immediate: true });

const dirty = computed(() => JSON.stringify(draft) !== JSON.stringify(opened.value));
const error = (key: string) => fieldError(errors.value, key);
const address = computed(() => `${PORTAL_INFO[props.portal].path === '/' ? '' : PORTAL_INFO[props.portal].path}/${props.type}/${draft.slug || '…'}`);

function payload(): EntryInput {
  return { ...draft, title: draft.title.trim(), slug: draft.slug.trim(), date: draft.date || null };
}

async function save(): Promise<void> {
  if (!def.value) return;
  if (!draft.title.trim()) {
    errors.value = { title: [`${def.value.title} wajib diisi.`] };
    return;
  }
  saving.value = true;
  const result = entry.value
    ? await contentClient.update(props.portal, kind.value, entry.value.id, { ...payload(), revision: entry.value.revision })
    : await contentClient.create(props.portal, kind.value, payload());
  saving.value = false;
  if (result.ok) {
    errors.value = undefined;
    const created = !entry.value;
    entry.value = result.data.entry;
    fill(fromEntry(result.data.entry));
    showToast(draft.status === 'published' ? 'Tersimpan dan tampil di situs' : 'Tersimpan sebagai draf', 'good');
    if (created) await router.replace({ name: routes.value.entry, params: { type: props.type, id: result.data.entry.id } });
    return;
  }
  if (result.code === 'VALIDATION_ERROR') {
    errors.value = result.errors;
    showToast(contentRefusalText(result), 'bad');
    return;
  }
  if (result.code === 'STALE_REVISION' && result.current) {
    // Someone saved first: keep what this editor changed, take the rest from their save.
    const current = result.current as ContentEntry;
    const theirs = fromEntry(current);
    const merged = mergeStale(opened.value, payload() as Draft, theirs);
    entry.value = current;
    opened.value = structuredClone(theirs);
    Object.assign(draft, merged);
    showToast('Konten ini baru diubah orang lain. Perubahan Anda dipertahankan; periksa lalu simpan lagi.', 'warn');
    return;
  }
  showToast(contentRefusalText(result), 'bad');
}

const confirmRemove = ref(false);
const removing = ref(false);
async function remove(): Promise<void> {
  if (!entry.value) return;
  removing.value = true;
  const result = await contentClient.remove(props.portal, kind.value, entry.value.id);
  removing.value = false;
  if (!result.ok) {
    showToast(contentRefusalText(result), 'bad');
    return;
  }
  confirmRemove.value = false;
  fill(blank());
  showToast('Konten dihapus', 'good');
  await router.replace({ name: routes.value.entries, params: { type: props.type } });
}

function setStatus(status: EntryStatus): void {
  draft.status = status;
  if (status === 'published' && has('date') && !draft.date && def.value?.order === 'newest') draft.date = dayWib();
}

// Leaving with unsaved changes asks first, in the page's own dialog.
const leaving = ref<((leave: boolean) => void) | null>(null);
onBeforeRouteLeave(() => (dirty.value && !removing.value ? new Promise<boolean>((resolve) => (leaving.value = resolve)) : true));
function answerLeave(leave: boolean): void {
  leaving.value?.(leave);
  leaving.value = null;
}
const beforeUnload = (event: BeforeUnloadEvent) => {
  if (dirty.value) event.preventDefault();
};
onMounted(() => window.addEventListener('beforeunload', beforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
</script>

<template>
  <AbPage
    v-if="def"
    :title="entry ? entry.title : `Tambah ${def.singular}`"
    :back="{ label: def.label, to: { name: routes.entries, params: { type } } }"
  >
    <template v-if="entry?.status === 'published' && !dirty" #actions>
      <AbButton variant="outline" :href="`${PORTAL_INFO[portal].path === '/' ? '' : PORTAL_INFO[portal].path}/${type}/${entry.slug}`" target="_blank">
        <ExternalLink :size="17" />Lihat di situs
      </AbButton>
    </template>

    <AbNotice v-if="loadError" tone="bad">
      {{ loadError }}
      <AbButton variant="outline" size="sm" @click="load">Coba lagi</AbButton>
    </AbNotice>
    <div v-else-if="loading" class="ee-state"><AbSpinner /></div>
    <form v-else class="ee" novalidate @submit.prevent="save">
      <div class="ee-main">
        <AbNotice v-if="entry?.legacyNote" tone="info" data-testid="legacy-note">
          <History :size="16" /> Dari situs lama: {{ entry.legacyNote }}
        </AbNotice>
        <AbCard>
          <div class="ee-fields">
            <AbField v-model="draft.title" :label="def.title" :error="error('title')" :maxlength="200" required />
            <AbField v-if="has('summary')" v-model="draft.summary" :label="partLabel('summary')" :error="error('summary')" multiline :rows="3" :maxlength="600" />
            <RichTextEditor v-if="has('body')" v-model="draft.body" :label="partLabel('body')" :error="error('body')" :compact="kind === 'faq'" />
          </div>
        </AbCard>
      </div>

      <aside class="ee-side">
        <AbCard title="Status">
          <div class="ee-status" role="radiogroup" aria-label="Status">
            <button type="button" role="radio" :aria-checked="draft.status === 'draft'" :class="{ 'is-on': draft.status === 'draft' }" @click="setStatus('draft')">
              <b>Draf</b><span>Belum tampil</span>
            </button>
            <button type="button" role="radio" :aria-checked="draft.status === 'published'" :class="{ 'is-on': draft.status === 'published' }" @click="setStatus('published')">
              <b>Terbit</b><span>Tampil di situs</span>
            </button>
          </div>
          <AbField v-if="has('date')" v-model="draft.date" type="date" :label="partLabel('date')" :error="error('date')" class="ee-date"
            :hint="kind === 'agenda' ? 'Kosongkan bila belum pasti.' : undefined" />
          <p v-if="entry" class="ee-meta">Terakhir disimpan {{ dateTimeShort(entry.updatedAt) }}</p>
        </AbCard>

        <AbCard v-if="has('image') || has('file')">
          <div class="ee-fields">
            <MediaImageField v-if="has('image')" v-model="draft.imageId" :label="partLabel('image')" :error="error('imageId')" :aspect="kind === 'guru' || kind === 'alumni' || kind === 'testimoni' ? '4 / 5' : '16 / 10'" />
            <MediaFileField v-if="has('file')" v-model="draft.fileId" :file="entry?.fileId === draft.fileId ? entry?.file : undefined" :label="partLabel('file')" :error="error('fileId')" />
          </div>
        </AbCard>

        <AbCard v-if="def.fields.length > 0" title="Keterangan">
          <div class="ee-fields">
            <AbField
              v-for="field in def.fields"
              :key="field.key"
              :model-value="draft.fields[field.key] ?? ''"
              :label="field.label"
              :placeholder="field.placeholder"
              :type="field.input === 'url' ? 'url' : 'text'"
              :inputmode="field.input === 'url' ? 'url' : undefined"
              :maxlength="field.max"
              :error="error(`fields.${field.key}`)"
              @update:model-value="draft.fields[field.key] = $event"
            />
          </div>
        </AbCard>

        <AbCard title="Alamat halaman">
          <AbField
            v-model="draft.slug"
            label="Alamat"
            :error="error('slug')"
            :hint="draft.slug ? address : 'Dibuat dari judul saat disimpan.'"
            :maxlength="120"
            autocomplete="off"
          />
        </AbCard>
      </aside>

      <div class="ee-bar">
        <AbButton v-if="entry" variant="ghost" class="ee-delete" @click="confirmRemove = true"><Trash2 :size="17" />Hapus</AbButton>
        <span v-if="dirty" class="ee-dirty">Ada perubahan yang belum disimpan</span>
        <AbButton type="submit" :loading="saving">{{ draft.status === 'published' ? 'Simpan & terbitkan' : 'Simpan draf' }}</AbButton>
      </div>
    </form>

    <AbDialog :open="confirmRemove" :title="`Hapus ${def.singular} ini?`" size="sm" :persistent="removing" @close="confirmRemove = false">
      <p class="ee-warning">“{{ entry?.title }}” hilang dari situs dan panel. Foto dan berkasnya tetap ada di Media. Tindakan ini tidak bisa dibatalkan.</p>
      <template #footer>
        <AbButton variant="outline" :disabled="removing" @click="confirmRemove = false">Batal</AbButton>
        <AbButton variant="danger" :loading="removing" @click="remove">Hapus</AbButton>
      </template>
    </AbDialog>

    <AbDialog :open="leaving !== null" title="Tinggalkan tanpa menyimpan?" size="sm" @close="answerLeave(false)">
      <p class="ee-warning">Perubahan yang belum disimpan akan hilang.</p>
      <template #footer>
        <AbButton variant="outline" @click="answerLeave(false)">Tetap di sini</AbButton>
        <AbButton variant="danger" @click="answerLeave(true)">Tinggalkan</AbButton>
      </template>
    </AbDialog>
  </AbPage>
  <AbPage v-else title="Jenis konten tidak dikenal" :back="{ label: 'Kembali', to: { name: routes.home } }">
    <AbEmpty title="Halaman ini tidak ada" text="Kembali ke ringkasan portal lalu pilih jenis konten." />
  </AbPage>
</template>

<style scoped>
.ee-state { display: grid; place-items: center; padding: 56px 0; }
.ee { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
.ee-main, .ee-side { display: grid; min-width: 0; gap: 18px; }
.ee-fields { display: grid; gap: 18px; }
.ee-status { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ee-status button { display: grid; gap: 2px; padding: 12px; border: 1.5px solid var(--ab-line); border-radius: 12px; text-align: left; }
.ee-status button b { font-size: 15px; }
.ee-status button span { color: var(--ab-mute); font-size: 12.5px; }
.ee-status button.is-on { border-color: var(--ab-forest); background: var(--ab-forest); color: #fff; }
.ee-status button.is-on span { color: rgba(255, 255, 255, .75); }
.ee-date { margin-top: 16px; }
.ee-meta { margin: 14px 0 0; color: var(--ab-mute); font-size: 13px; }
.ee-bar {
  position: sticky;
  bottom: calc(12px + var(--ab-safe-bottom));
  z-index: 20;
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--ab-line);
  border-radius: var(--ab-radius-l);
  background: var(--ab-card);
  box-shadow: var(--ab-shadow-pop);
}
.ee-delete { margin-right: auto; color: var(--ab-red); }
.ee-dirty { color: var(--ab-mute); font-size: 13.5px; font-weight: 600; }
.ee-warning { margin: 0; color: var(--ab-ink-2); }
@media (max-width: 1023px) {
  .ee { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 719px) {
  .ee-dirty { display: none; }
}
</style>
