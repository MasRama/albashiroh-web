<script setup lang="ts">
import { ChevronLeft, ChevronRight, X } from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';
import type { PublicEntry } from '../../../features/content/web';
import { longDate, youtubeId } from '../site';

/**
 * One gallery item at full size in a modal dialog: the photo, or the video
 * playing from youtube-nocookie. Arrows and the keyboard step through the
 * list; Esc, the close button or a click on the backdrop closes it.
 */
const props = defineProps<{ items: PublicEntry[] }>();
const index = defineModel<number | null>({ required: true });
const dialog = ref<HTMLDialogElement | null>(null);
const item = computed(() => (index.value === null ? null : props.items[index.value] ?? null));
const video = computed(() => youtubeId(item.value?.fields.video));

watch(index, async (value) => {
  await nextTick();
  const element = dialog.value;
  if (!element) return;
  // Browsers without modal dialogs (and test DOMs) still show it, as a plain open dialog.
  if (value !== null && !element.open) {
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
  }
  if (value === null && element.open) {
    if (typeof element.close === 'function') element.close();
    else element.removeAttribute('open');
  }
});

function step(delta: number) {
  if (index.value === null || props.items.length < 2) return;
  index.value = (index.value + delta + props.items.length) % props.items.length;
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') step(1);
  if (event.key === 'ArrowLeft') step(-1);
}
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) index.value = null;
}
</script>

<template>
  <dialog ref="dialog" class="lb" aria-label="Galeri" @close="index = null" @click="onBackdrop" @keydown="onKey">
    <div v-if="item" class="lb-in">
      <div class="lb-stage">
        <iframe
          v-if="video"
          :key="video"
          :src="`https://www.youtube-nocookie.com/embed/${video}?autoplay=1&rel=0`"
          :title="item.title"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
        />
        <img v-else-if="item.image" :src="item.image.lg" :alt="item.image.alt || item.title" :width="item.image.width" :height="item.image.height" />
      </div>
      <div class="lb-foot">
        <div>
          <b>{{ item.title }}</b>
          <span v-if="item.summary || item.date">{{ [item.summary, longDate(item.date)].filter(Boolean).join(' · ') }}</span>
        </div>
        <div class="lb-nav">
          <span class="lb-count">{{ (index ?? 0) + 1 }} / {{ items.length }}</span>
          <button v-if="items.length > 1" type="button" aria-label="Sebelumnya" @click="step(-1)"><ChevronLeft :size="20" /></button>
          <button v-if="items.length > 1" type="button" aria-label="Berikutnya" @click="step(1)"><ChevronRight :size="20" /></button>
          <button type="button" class="lb-close" aria-label="Tutup" @click="index = null"><X :size="20" /></button>
        </div>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* The page's reset zeroes every margin; a modal dialog centres itself with margin: auto. */
.lb { width: min(1180px, calc(100vw - 32px)); max-width: none; max-height: calc(100dvh - 32px); margin: auto; padding: 0; overflow: hidden; border: 0; border-radius: 24px; background: var(--ab-ink); color: #fff; }
.lb::backdrop { background: rgba(8, 16, 12, .86); }
.lb-in { display: flex; max-height: calc(100dvh - 32px); flex-direction: column; }
.lb-stage { display: grid; min-height: 0; flex: 1; place-items: center; background: #000; }
.lb-stage img { width: 100%; max-height: calc(100dvh - 140px); object-fit: contain; }
.lb-stage iframe { display: block; width: 100%; border: 0; aspect-ratio: 16 / 9; max-height: calc(100dvh - 140px); }
.lb-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; }
.lb-foot b { display: block; font-size: 16px; font-weight: 700; }
.lb-foot span { color: rgba(255, 255, 255, .65); font-size: 13.5px; }
.lb-nav { display: flex; flex: none; align-items: center; gap: 8px; }
.lb-count { margin-right: 6px; font-weight: 700; }
.lb-nav button { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 12px; background: rgba(255, 255, 255, .12); color: #fff; }
.lb-nav button:hover { background: rgba(255, 255, 255, .22); }
.lb-nav .lb-close { background: #fff; color: var(--ab-ink); }
.lb-nav .lb-close:hover { background: var(--ab-paper); }
@media (max-width: 640px) {
  .lb { border-radius: 18px; }
  .lb-foot { flex-direction: column; align-items: stretch; padding: 14px 16px; }
  .lb-nav { justify-content: flex-end; }
  .lb-count { margin-right: auto; }
}
</style>
