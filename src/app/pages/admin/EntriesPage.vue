<script setup lang="ts">
import { ArrowDown, ArrowUp, FileText, Plus } from '@lucide/vue';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CONTENT_TYPES, contentRefusalText, contentType, type ContentEntry, type ContentType, type EntryStatus, type Portal } from '../../../features/content/web';
import { MediaThumb } from '../../../features/media/web';
import { AbBadge, AbButton, AbCard, AbEmpty, AbNotice, AbPage, AbSearch, AbSpinner, showToast } from '../../../shared/ui';
import { contentClient } from '../../cms';
import { entryFacts, PORTAL_LABEL, portalRoute, TYPE_ICON } from '../../content-admin';

/**
 * Every entry of one type in one portal: find, filter (live or draft, still
 * without a photo), open, and, for types the school orders by hand, move up
 * and down.
 */
const props = defineProps<{ portal: Portal; type: string }>();
const route = useRoute();
const router = useRouter();

const def = computed(() => contentType(props.type));
const kind = computed(() => props.type as ContentType);
const routes = computed(() => portalRoute(props.portal));
const takesImage = computed(() => Boolean(def.value && 'image' in def.value && def.value.image));
const manual = computed(() => def.value?.order === 'manual');

const STATUS: { value: EntryStatus | ''; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'published', label: 'Terbit' },
  { value: 'draft', label: 'Draf' },
];
// Filters live in the address, so the overview's "belum ada gambar" link and the back button land on the same list.
const status = computed<EntryStatus | ''>({
  get: () => (route.query.status === 'published' || route.query.status === 'draft' ? route.query.status : ''),
  set: (value) => void router.replace({ query: { ...route.query, status: value || undefined } }),
});
const missingImage = computed<boolean>({
  get: () => route.query.gambar === 'kosong',
  set: (value) => void router.replace({ query: { ...route.query, gambar: value ? 'kosong' : undefined } }),
});
const query = ref('');
const term = ref('');
let pause: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(pause);
  pause = setTimeout(() => (term.value = value.trim()), 250);
});
onUnmounted(() => clearTimeout(pause));

const items = ref<ContentEntry[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const error = ref<string | null>(null);
const LIMIT = 50;
let ticket = 0;

async function load(reset = true): Promise<void> {
  if (!def.value) return;
  const mine = ++ticket;
  loading.value = true;
  const next = reset ? 1 : page.value + 1;
  const result = await contentClient.list(props.portal, kind.value, {
    page: next,
    limit: LIMIT,
    q: term.value || undefined,
    status: status.value || undefined,
    missingImage: missingImage.value && takesImage.value,
  });
  if (mine !== ticket) return;
  loading.value = false;
  if (!result.ok) {
    error.value = contentRefusalText(result);
    return;
  }
  error.value = null;
  page.value = next;
  total.value = result.data.total;
  items.value = reset ? result.data.items : [...items.value, ...result.data.items];
}
watch([() => props.portal, () => props.type, status, missingImage, term], () => void load(), { immediate: true });

// Moving is offered on the whole, unfiltered list only, so a move never hides entries between.
const canMove = computed(() => manual.value && !status.value && !missingImage.value && !term.value && items.value.length === total.value);
const moving = ref(false);
async function move(index: number, by: -1 | 1): Promise<void> {
  const target = index + by;
  if (target < 0 || target >= items.value.length) return;
  const order = [...items.value];
  [order[index], order[target]] = [order[target]!, order[index]!];
  const previous = items.value;
  items.value = order;
  moving.value = true;
  const result = await contentClient.reorder(props.portal, kind.value, order.map((item) => item.id));
  moving.value = false;
  if (!result.ok) {
    items.value = previous;
    showToast(contentRefusalText(result), 'bad');
  }
}

const emptyText = computed(() => {
  if (term.value) return { title: 'Tidak ada yang cocok', text: 'Coba kata lain.' };
  if (missingImage.value) return { title: 'Semua sudah bergambar', text: 'Tidak ada konten yang masih menunggu foto.' };
  if (status.value) return { title: 'Tidak ada di sini', text: 'Ganti saringan untuk melihat yang lain.' };
  return { title: `Belum ada ${def.value?.singular ?? 'konten'}`, text: def.value?.note };
});
</script>

<template>
  <AbPage
    v-if="def"
    :title="def.label"
    :description="def.note"
    :back="{ label: PORTAL_LABEL[portal], to: { name: routes.home } }"
  >
    <template #actions>
      <AbButton :to="{ name: routes.create, params: { type } }"><Plus :size="18" />Tambah {{ def.singular }}</AbButton>
    </template>

    <AbCard>
      <div class="el-tools">
        <div class="el-filter" role="radiogroup" aria-label="Status">
          <button
            v-for="option in STATUS"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="status === option.value"
            class="el-filter-option"
            :class="{ 'is-on': status === option.value }"
            @click="status = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <label v-if="takesImage" class="el-check">
          <input v-model="missingImage" type="checkbox" />
          <span>Belum ada gambar</span>
        </label>
        <AbSearch v-model="query" :placeholder="`Cari ${def.singular}`" :label="`Cari ${def.label}`" />
      </div>

      <AbNotice v-if="error" tone="bad">
        {{ error }}
        <AbButton variant="outline" size="sm" @click="load()">Coba lagi</AbButton>
      </AbNotice>
      <div v-else-if="loading && items.length === 0" class="el-state"><AbSpinner /></div>
      <AbEmpty v-else-if="items.length === 0" :icon="TYPE_ICON[kind]" :title="emptyText.title" :text="emptyText.text" />
      <ol v-else class="el-list" :aria-label="def.label">
        <li v-for="(item, index) in items" :key="item.id" class="el-row" :data-entry-id="item.id">
          <RouterLink :to="{ name: routes.entry, params: { type, id: item.id } }" class="el-open">
            <MediaThumb v-if="takesImage" :id="item.image?.id ?? null" :alt="item.image?.alt" :size="64" />
            <span v-else-if="'file' in CONTENT_TYPES[kind]" class="el-doc"><FileText :size="22" /></span>
            <span class="el-text">
              <b>{{ item.title }}</b>
              <span v-if="entryFacts(item)" class="el-facts">{{ entryFacts(item) }}</span>
              <span v-else-if="item.summary" class="el-facts">{{ item.summary }}</span>
            </span>
            <AbBadge :tone="item.status === 'published' ? 'green' : 'gray'" dot>{{ item.status === 'published' ? 'Terbit' : 'Draf' }}</AbBadge>
          </RouterLink>
          <span v-if="canMove" class="el-move">
            <button type="button" :aria-label="`Naikkan ${item.title}`" :disabled="moving || index === 0" @click="move(index, -1)"><ArrowUp :size="16" /></button>
            <button type="button" :aria-label="`Turunkan ${item.title}`" :disabled="moving || index === items.length - 1" @click="move(index, 1)"><ArrowDown :size="16" /></button>
          </span>
        </li>
      </ol>
      <div v-if="items.length < total" class="el-more">
        <AbButton variant="outline" :loading="loading" @click="load(false)">Muat lebih banyak</AbButton>
      </div>
    </AbCard>
  </AbPage>
  <AbPage v-else title="Jenis konten tidak dikenal" :back="{ label: PORTAL_LABEL[portal], to: { name: routes.home } }">
    <AbEmpty title="Halaman ini tidak ada" text="Kembali ke ringkasan portal lalu pilih jenis konten." />
  </AbPage>
</template>

<style scoped>
.el-tools { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 14px; }
.el-tools > :last-child { flex: 1 1 220px; }
.el-filter { display: inline-flex; padding: 4px; border-radius: 12px; background: var(--ab-paper-2); }
.el-filter-option { padding: 8px 14px; border-radius: 9px; color: var(--ab-ink-2); font-size: 14px; font-weight: 700; }
.el-filter-option.is-on { background: var(--ab-forest); color: #fff; }
.el-check { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--ab-line); border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; }
.el-check input { width: 18px; height: 18px; accent-color: var(--ab-forest); }
.el-state { display: grid; place-items: center; padding: 56px 0; }
.el-list { margin: 0; padding: 0; list-style: none; }
.el-row { display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--ab-line); }
.el-row:first-child { border-top: 0; }
.el-open { display: flex; min-width: 0; flex: 1; align-items: center; gap: 14px; padding: 12px 6px; border-radius: 12px; }
.el-open:hover { background: var(--ab-paper); }
.el-doc { display: grid; flex: none; width: 48px; height: 48px; place-items: center; border-radius: 12px; background: var(--ab-forest); color: #fff; }
.el-text { display: grid; min-width: 0; flex: 1; gap: 2px; }
/* Two lines before the cut: a phone row is narrow and news titles are long. */
.el-text b { display: -webkit-box; overflow: hidden; font-size: 15.5px; line-height: 1.3; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow-wrap: anywhere; }
.el-facts { overflow: hidden; color: var(--ab-mute); font-size: 13.5px; text-overflow: ellipsis; white-space: nowrap; }
.el-move { display: flex; flex: none; gap: 2px; }
.el-move button { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 9px; color: var(--ab-ink-2); }
.el-move button:hover:not(:disabled) { background: var(--ab-paper-2); color: var(--ab-forest); }
.el-move button:disabled { opacity: .3; }
.el-more { display: flex; justify-content: center; margin-top: 16px; }
@media (max-width: 719px) {
  .el-open { gap: 10px; padding: 10px 2px; }
  .el-move { flex-direction: column; }
  .el-move button { width: 30px; height: 28px; }
}
</style>
