<script setup lang="ts">
import { ImagePlus, Images, Trash2, Upload } from 'lucide-vue-next';
import { ref, useId, watch } from 'vue';
import { AbButton, showToast } from '../../../../shared/ui';
import type { MediaItem } from '../../contract';
import { IMAGE_ACCEPT, imageUrl, mediaRefusalText, useMediaClient } from '../client';
import MediaPicker from './MediaPicker.vue';

/**
 * A form's photo. Holds a media id; with none it shows a clear "no picture
 * yet" state with an upload button, so missing pictures read as a to-do,
 * never as a broken image.
 */
const props = withDefaults(
  defineProps<{ label: string; modelValue: string | null | undefined; hint?: string; error?: string; aspect?: string; disabled?: boolean }>(),
  { aspect: '16 / 9' },
);
const emit = defineEmits<{ 'update:modelValue': [value: string | null]; picked: [item: MediaItem] }>();

const client = useMediaClient();
const id = useId();
const picking = ref(false);
const uploading = ref(false);
const missing = ref(false);
const input = ref<HTMLInputElement>();

watch(
  () => props.modelValue,
  () => {
    missing.value = false;
  },
);

function choose(item: MediaItem): void {
  picking.value = false;
  emit('update:modelValue', item.id);
  emit('picked', item);
}

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
  choose(result.data.item);
}
</script>

<template>
  <div class="mf" role="group" :aria-labelledby="`${id}-label`" :aria-describedby="hint || error ? `${id}-note` : undefined">
    <span :id="`${id}-label`" class="mf-label">{{ label }}</span>
    <input ref="input" class="ab-visually-hidden" type="file" :accept="IMAGE_ACCEPT" tabindex="-1" aria-hidden="true" @change="upload" />
    <div v-if="modelValue && !missing" class="mf-filled">
      <img class="mf-preview" :style="{ aspectRatio: aspect }" :src="imageUrl(modelValue, 'md')" :alt="`Gambar ${label}`" @error="missing = true" />
      <div class="mf-actions">
        <AbButton variant="outline" size="sm" :disabled="disabled" @click="picking = true"><Images :size="16" />Ganti</AbButton>
        <AbButton variant="ghost" size="sm" :disabled="disabled" @click="emit('update:modelValue', null)"><Trash2 :size="16" />Hapus gambar</AbButton>
      </div>
    </div>
    <div v-else class="mf-empty" :class="{ 'mf-empty--bad': error }" :style="{ aspectRatio: aspect }" data-testid="image-empty">
      <ImagePlus :size="30" aria-hidden="true" />
      <b>Belum ada gambar, unggah sekarang</b>
      <span v-if="missing">Gambar sebelumnya sudah dihapus dari pustaka.</span>
      <span v-else>Foto JPG, PNG atau WebP, paling besar 15 MB.</span>
      <div class="mf-actions">
        <AbButton size="sm" :loading="uploading" :disabled="disabled" @click="input?.click()"><Upload :size="16" />Unggah sekarang</AbButton>
        <AbButton variant="outline" size="sm" :disabled="disabled || uploading" @click="picking = true"><Images :size="16" />Pilih dari pustaka</AbButton>
      </div>
    </div>
    <p v-if="error || hint" :id="`${id}-note`" class="mf-note" :class="{ 'mf-note--bad': error }">{{ error ?? hint }}</p>
    <MediaPicker :open="picking" kind="image" @close="picking = false" @select="choose" />
  </div>
</template>

<style scoped>
/* One column no wider than the field: the empty box's minimum height, through its aspect ratio, would otherwise widen a narrow column. */
.mf { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.mf-label { font-size: 14.5px; font-weight: 700; }
.mf-filled { display: grid; gap: 10px; }
.mf-preview { display: block; width: 100%; max-height: 360px; border: 1px solid var(--ab-line); border-radius: 14px; background: var(--ab-paper-2); object-fit: cover; }
.mf-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.mf-empty {
  display: flex;
  width: 100%;
  max-height: 360px;
  min-height: 190px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px;
  border: 2px dashed var(--ab-line-strong);
  border-radius: 14px;
  background: var(--ab-card);
  color: var(--ab-mute);
  text-align: center;
}
.mf-empty b { color: var(--ab-ink); font-size: 15px; }
.mf-empty span { font-size: 13px; }
.mf-empty .mf-actions { justify-content: center; margin-top: 6px; }
.mf-empty--bad { border-color: var(--ab-red); }
.mf-note { margin: 0; color: var(--ab-mute); font-size: 13px; }
.mf-note--bad { color: var(--ab-red); font-weight: 600; }
</style>
