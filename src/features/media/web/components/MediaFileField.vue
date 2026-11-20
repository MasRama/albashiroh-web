<script setup lang="ts">
import { FilePlus2, FileText, FolderOpen, Trash2, Upload } from '@lucide/vue';
import { ref, useId } from 'vue';
import { AbButton, showToast } from '../../../../shared/ui';
import type { FileRef, MediaItem } from '../../contract';
import { FILE_ACCEPT, formatBytes, mediaRefusalText, useMediaClient } from '../client';
import MediaPicker from './MediaPicker.vue';

/**
 * A form's downloadable document. `file` describes what the id points at, as
 * the content API answers it; without one, the field asks for an upload.
 */
const props = defineProps<{ label: string; modelValue: string | null | undefined; file?: FileRef | null; hint?: string; error?: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string | null]; picked: [item: MediaItem] }>();

const client = useMediaClient();
const id = useId();
const picking = ref(false);
const uploading = ref(false);
const chosen = ref<{ name: string; size: number } | null>(null);
const input = ref<HTMLInputElement>();

function choose(item: MediaItem): void {
  picking.value = false;
  chosen.value = { name: item.name, size: item.size };
  emit('update:modelValue', item.id);
  emit('picked', item);
}

function clear(): void {
  chosen.value = null;
  emit('update:modelValue', null);
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

const shown = () => chosen.value ?? (props.file ? { name: props.file.name, size: props.file.size } : null);
</script>

<template>
  <div class="ff" role="group" :aria-labelledby="`${id}-label`">
    <span :id="`${id}-label`" class="ff-label">{{ label }}</span>
    <input ref="input" class="ab-visually-hidden" type="file" :accept="FILE_ACCEPT" tabindex="-1" aria-hidden="true" @change="upload" />
    <div v-if="modelValue && shown()" class="ff-row">
      <span class="ff-icon"><FileText :size="20" /></span>
      <span class="ff-text"><b>{{ shown()!.name }}</b><span>{{ formatBytes(shown()!.size) }}</span></span>
      <AbButton variant="outline" size="sm" :disabled="disabled" @click="picking = true">Ganti</AbButton>
      <AbButton variant="ghost" size="sm" :disabled="disabled" :aria-label="`Lepas ${shown()!.name}`" @click="clear"><Trash2 :size="16" /></AbButton>
    </div>
    <div v-else class="ff-empty" :class="{ 'ff-empty--bad': error }" data-testid="file-empty">
      <FilePlus2 :size="24" aria-hidden="true" />
      <span class="ff-text"><b>Belum ada berkas, unggah sekarang</b><span>PDF, Word, Excel, PowerPoint atau foto, paling besar 25 MB.</span></span>
      <div class="ff-actions">
        <AbButton size="sm" :loading="uploading" :disabled="disabled" @click="input?.click()"><Upload :size="16" />Unggah sekarang</AbButton>
        <AbButton variant="outline" size="sm" :disabled="disabled || uploading" @click="picking = true"><FolderOpen :size="16" />Pustaka</AbButton>
      </div>
    </div>
    <p v-if="error || hint" class="ff-note" :class="{ 'ff-note--bad': error }">{{ error ?? hint }}</p>
    <MediaPicker :open="picking" kind="file" @close="picking = false" @select="choose" />
  </div>
</template>

<style scoped>
.ff { display: grid; gap: 8px; }
.ff-label { font-size: 14.5px; font-weight: 700; }
.ff-row, .ff-empty {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--ab-line);
  border-radius: 14px;
  background: var(--ab-card);
}
.ff-empty { border: 2px dashed var(--ab-line-strong); color: var(--ab-mute); }
.ff-empty--bad { border-color: var(--ab-red); }
.ff-icon { display: grid; width: 40px; height: 40px; flex: none; place-items: center; border-radius: 10px; background: var(--ab-forest); color: #fff; }
.ff-text { display: grid; min-width: 0; flex: 1 1 180px; }
.ff-text b { overflow: hidden; color: var(--ab-ink); font-size: 14.5px; text-overflow: ellipsis; white-space: nowrap; }
.ff-text span { color: var(--ab-mute); font-size: 13px; }
.ff-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ff-note { margin: 0; color: var(--ab-mute); font-size: 13px; }
.ff-note--bad { color: var(--ab-red); font-weight: 600; }
</style>
