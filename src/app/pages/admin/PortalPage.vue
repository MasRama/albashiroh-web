<script setup lang="ts">
import { ArrowRight, ExternalLink, ImageOff, Settings2 } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { CONTENT_TYPES, contentRefusalText, PORTAL_INFO, type Portal, type TypeSummary } from '../../../features/content/web';
import { AbButton, AbNotice, AbPage, AbSpinner, count } from '../../../shared/ui';
import { contentClient } from '../../cms';
import { PORTAL_LABEL, portalRoute, TYPE_ICON } from '../../content-admin';

/**
 * One portal's content at a glance: its settings, then each kind of entry
 * with how many there are, how many are live, and how many still need a
 * photo, which after the import from the old site is the school's to-do list.
 */
const props = defineProps<{ portal: Portal }>();

const types = ref<TypeSummary[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const routes = computed(() => portalRoute(props.portal));

async function load(): Promise<void> {
  loading.value = true;
  const result = await contentClient.summary(props.portal);
  loading.value = false;
  if (!result.ok) {
    error.value = contentRefusalText(result);
    return;
  }
  error.value = null;
  types.value = result.data.types;
}
watch(() => props.portal, () => void load(), { immediate: true });

const missing = computed(() => types.value.reduce((sum, row) => sum + row.withoutImage, 0));
</script>

<template>
  <AbPage :title="PORTAL_LABEL[portal]" :description="`Isi ${PORTAL_INFO[portal].name}. Konten berstatus Terbit langsung tampil di situs.`">
    <template #actions>
      <AbButton variant="outline" :href="PORTAL_INFO[portal].path" target="_blank"><ExternalLink :size="17" />Lihat situs</AbButton>
    </template>

    <AbNotice v-if="error" tone="bad">
      {{ error }}
      <AbButton variant="outline" size="sm" @click="load">Coba lagi</AbButton>
    </AbNotice>
    <div v-else-if="loading && types.length === 0" class="pp-state"><AbSpinner /></div>
    <template v-else>
      <AbNotice v-if="missing > 0" tone="warn" data-testid="missing-images">
        <b>{{ count(missing, 'konten') }} belum punya gambar.</b>
        Foto dari situs lama tidak ikut pindah. Situs menampilkan sampul polos sampai fotonya diunggah ulang.
      </AbNotice>

      <RouterLink :to="{ name: routes.settings }" class="pp-settings">
        <span class="pp-settings-icon"><Settings2 :size="24" /></span>
        <span class="pp-settings-text">
          <b>Pengaturan {{ PORTAL_INFO[portal].short === 'Yayasan' ? 'situs' : 'portal' }}</b>
          <span>Beranda, profil, {{ portal === 'yayasan' ? 'Takhosus, keasramaan' : 'prakata kepala sekolah, kompetensi lulusan' }}, kontak dan PPDB.</span>
        </span>
        <ArrowRight :size="20" class="pp-go" />
      </RouterLink>

      <ul class="pp-grid" aria-label="Jenis konten">
        <li v-for="row in types" :key="row.type">
          <RouterLink :to="{ name: routes.entries, params: { type: row.type } }" class="pp-type" :data-type="row.type">
            <span class="pp-type-head">
              <span class="pp-type-icon"><component :is="TYPE_ICON[row.type]" :size="20" /></span>
              <b>{{ CONTENT_TYPES[row.type].label }}</b>
            </span>
            <span class="pp-type-count">
              <span class="pp-big num">{{ row.total }}</span>
              <span>{{ row.total === 0 ? 'Belum ada isi' : `${row.published} terbit` }}</span>
            </span>
            <span v-if="row.withoutImage > 0" class="pp-flag"><ImageOff :size="15" />{{ row.withoutImage }} belum ada gambar</span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </AbPage>
</template>

<style scoped>
.pp-state { display: grid; place-items: center; padding: 56px 0; }
.pp-settings {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 18px 0;
  padding: 18px 20px;
  border-radius: var(--ab-radius-l);
  background: var(--ab-forest);
  color: #fff;
}
.pp-settings:hover .pp-go { transform: translateX(3px); }
.pp-settings-icon { display: grid; flex: none; width: 48px; height: 48px; place-items: center; border-radius: 14px; background: var(--ab-sun); color: var(--ab-forest); }
.pp-settings-text { display: grid; flex: 1; gap: 2px; }
.pp-settings-text b { font-family: var(--ab-display); font-size: 19px; font-weight: 800; }
.pp-settings-text span { color: rgba(255, 255, 255, .78); font-size: 14px; }
.pp-go { flex: none; transition: transform .15s; }
.pp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin: 0; padding: 0; list-style: none; }
.pp-type {
  display: grid;
  height: 100%;
  align-content: start;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--ab-line);
  border-radius: var(--ab-radius-l);
  background: var(--ab-card);
}
.pp-type:hover, .pp-type:focus-visible { border-color: var(--ab-forest); }
.pp-type-head { display: flex; align-items: center; gap: 10px; }
.pp-type-head b { font-size: 15.5px; }
.pp-type-icon { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 11px; background: var(--ab-paper-2); color: var(--ab-forest); }
.pp-type-count { display: flex; align-items: baseline; gap: 8px; color: var(--ab-mute); font-size: 14px; }
.pp-big { color: var(--ab-ink); font-family: var(--ab-display); font-size: 34px; font-weight: 800; line-height: 1; }
.pp-flag { display: inline-flex; width: fit-content; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: var(--ab-sun); color: var(--ab-forest); font-size: 13px; font-weight: 800; }
@media (max-width: 719px) {
  .pp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .pp-type { padding: 14px; }
  .pp-big { font-size: 28px; }
  .pp-settings { padding: 16px; }
}
</style>
