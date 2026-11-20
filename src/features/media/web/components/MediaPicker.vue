<script setup lang="ts">
import { FileText, Upload } from '@lucide/vue';
import { computed, onUnmounted, ref, watch } from 'vue';
import { onServerEvent } from '../../../../shared/realtime/browser';
import { AbButton, AbDialog, AbEmpty, AbNotice, AbSearch, AbSpinner, showToast } from '../../../../shared/ui';
import { MEDIA_CHANGED_EVENT, type MediaItem, type MediaKind } from '../../contract';
import { FILE_ACCEPT, IMAGE_ACCEPT, formatBytes, imageUrl, mediaRefusalText, useMediaClient } from '../client';

/**
 * Choose a photo or document from the library, or upload a new one, which is
 * chosen as soon as it is stored. `kind: 'file'` lists every item, because a
 * flyer photo can be a download too.
 */
const props = withDefaults(defineProps<{ open: boolean; kind?: MediaKind; title?: string }>(), { kind: 'image' });
const emit = defineEmits<{ close: []; select: [item: MediaItem] }>();

const client = useMediaClient();
const query = ref('');
const items = ref<MediaItem[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const error = ref<string | null>(null);
const uploading = ref(false);
const input = ref<HTMLInputElement>();
const heading = computed(() => props.title ?? (props.kind === 'image' ? 'Pilih gambar' : 'Pilih dokumen'));
let ticket = 0;

async function load(reset = true): Promise<void> {
  const mine = ++ticket;
  loading.value = true;
  const next = reset ? 1 : page.value + 1;
  const result = await client.list({ page: next, limit: 24, kind: props.kind === 'image' ? 'image' : undefined, q: query.value.trim() || undefined });
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

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(query, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void load(), 250);
});
watch(
  () => props.open,
  (open) => {
    if (open) void load();
  },
  { immediate: true },
);
onUnmounted(
  onServerEvent(MEDIA_CHANGED_EVENT, () => {
    if (props.open && !uploading.value) void load();
  }),
);
onUnmounted(() => clearTimeout(searchTimer));

async function upload(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  (event.target as HTMLInputElement).value = '';
  if (!file) return;
  uploading.value = true;
  const result = await client.upload(file);
  uploading.value = false;
  if (!result.ok) {
    showToast(mediaRefusalText(result), 'bad');
    return;
  }
  emit('select', result.data.item);
}
</script>

<template>
  <AbDialog :open="open" :title="heading" size="lg" @close="emit('close')">
    <div class="mp-tools">
      <AbSearch v-model="query" :placeholder="kind === 'image' ? 'Cari gambar' : 'Cari dokumen'" :label="kind === 'image' ? 'Cari gambar' : 'Cari dokumen'" />
      <input ref="input" class="ab-visually-hidden" type="file" :accept="kind === 'image' ? IMAGE_ACCEPT : FILE_ACCEPT" tabindex="-1" aria-hidden="true" @change="upload" />
      <AbButton :loading="uploading" @click="input?.click()"><Upload :size="18" />Unggah dari perangkat</AbButton>
    </div>
    <AbNotice v-if="error" tone="bad">{{ error }}</AbNotice>
    <div v-else-if="loading && items.length === 0" class="mp-state"><AbSpinner /></div>
    <AbEmpty
      v-else-if="items.length === 0"
      :title="query ? 'Tidak ada yang cocok' : kind === 'image' ? 'Pustaka gambar masih kosong' : 'Pustaka dokumen masih kosong'"
      :text="query ? 'Coba kata lain.' : 'Unggah yang pertama dari perangkat Anda.'"
    />
    <ul v-else-if="kind === 'image'" class="mp-grid" aria-label="Gambar di pustaka">
      <li v-for="item in items" :key="item.id">
        <button type="button" class="mp-tile" :data-media-id="item.id" :aria-label="`Pilih ${item.name}`" @click="emit('select', item)">
          <img :src="imageUrl(item.id, 'sm')" :alt="item.alt" loading="lazy" decoding="async" />
          <span class="mp-tile-name">{{ item.name }}</span>
        </button>
      </li>
    </ul>
    <ul v-else class="mp-list" aria-label="Berkas di pustaka">
      <li v-for="item in items" :key="item.id">
        <button type="button" class="mp-row" :data-media-id="item.id" @click="emit('select', item)">
          <img v-if="item.kind === 'image'" :src="imageUrl(item.id, 'sm')" alt="" class="mp-row-thumb" loading="lazy" />
          <span v-else class="mp-row-icon"><FileText :size="20" /></span>
          <span class="mp-row-text"><b>{{ item.name }}</b><span>{{ formatBytes(item.size) }}</span></span>
        </button>
      </li>
    </ul>
    <div v-if="items.length < total" class="mp-more">
      <AbButton variant="outline" :loading="loading" @click="load(false)">Muat lebih banyak</AbButton>
    </div>
  </AbDialog>
</template>

<style scoped>
.mp-tools { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
.mp-tools > :first-child { flex: 1 1 220px; }
.mp-state { display: grid; place-items: center; padding: 48px 0; }
.mp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
.mp-tile {
  display: block;
  width: 100%;
  overflow: hidden;
  border: 1.5px solid var(--ab-line);
  border-radius: 14px;
  background: var(--ab-card);
  text-align: left;
}
.mp-tile:hover, .mp-tile:focus-visible { border-color: var(--ab-forest); }
.mp-tile img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: var(--ab-paper-2); }
.mp-tile-name { display: block; overflow: hidden; padding: 8px 10px; font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.mp-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.mp-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1.5px solid var(--ab-line);
  border-radius: 12px;
  background: var(--ab-card);
  text-align: left;
}
.mp-row:hover, .mp-row:focus-visible { border-color: var(--ab-forest); }
.mp-row-thumb, .mp-row-icon { width: 44px; height: 44px; flex: none; border-radius: 10px; object-fit: cover; }
.mp-row-icon { display: grid; place-items: center; background: var(--ab-forest); color: #fff; }
.mp-row-text { display: grid; min-width: 0; }
.mp-row-text b { overflow: hidden; font-size: 14.5px; text-overflow: ellipsis; white-space: nowrap; }
.mp-row-text span { color: var(--ab-mute); font-size: 13px; }
.mp-more { display: flex; justify-content: center; margin-top: 16px; }
</style>
