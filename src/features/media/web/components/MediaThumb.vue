<script setup lang="ts">
import { ImageOff } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { imageUrl } from '../client';

/**
 * A list thumbnail. With no photo (never uploaded, or deleted since) it says
 * so plainly, so the school can see at a glance what still needs a picture.
 */
const props = withDefaults(defineProps<{ id: string | null | undefined; alt?: string; size?: number; label?: boolean }>(), {
  alt: '',
  size: 56,
  label: true,
});

const failed = ref(false);
watch(
  () => props.id,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <span class="mt" :style="{ width: `${size}px`, height: `${size}px` }">
    <img v-if="id && !failed" :src="imageUrl(id, 'sm')" :alt="alt" loading="lazy" decoding="async" @error="failed = true" />
    <span v-else class="mt-empty" data-testid="thumb-empty" :title="'Belum ada gambar'">
      <ImageOff :size="Math.max(14, Math.round(size / 3.2))" aria-hidden="true" />
      <span v-if="label && size >= 56" class="mt-empty-text">Belum ada gambar</span>
      <span v-else class="ab-visually-hidden">Belum ada gambar</span>
    </span>
  </span>
</template>

<style scoped>
.mt {
  display: inline-flex;
  flex: none;
  overflow: hidden;
  border-radius: 12px;
  background: var(--ab-paper-2);
}
.mt img { width: 100%; height: 100%; object-fit: cover; }
.mt-empty {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1.5px dashed var(--ab-line-strong);
  border-radius: inherit;
  color: var(--ab-mute);
  text-align: center;
}
.mt-empty-text { padding: 0 4px; font-size: 9.5px; font-weight: 700; line-height: 1.15; }
</style>
