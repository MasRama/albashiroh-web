<script setup lang="ts">
import { Play } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import type { EntryImage } from '../../../features/content/web';
import { youtubeId } from '../site';

/**
 * A portal's profile video on its home page: the heading, then the poster
 * with a play button. YouTube loads only after the visitor presses play, from
 * youtube-nocookie, so the page stays light and sets no cookie before that.
 * The poster is the school's own photo, or the video's YouTube thumbnail.
 */
const props = defineProps<{ url: string; poster: EntryImage | null; kick: string; title: string; lead: string }>();
const id = computed(() => youtubeId(props.url));
const playing = ref(false);
// YouTube has the wide thumbnail only for videos uploaded in HD; the small one is always there.
const wide = ref(true);
watch(id, () => {
  playing.value = false;
  wide.value = true;
});
const thumb = computed(() => (id.value ? `https://i.ytimg.com/vi/${id.value}/${wide.value ? 'maxresdefault' : 'hqdefault'}.jpg` : ''));

function checkThumb(event: Event) {
  // A missing wide thumbnail still answers with a 120px grey placeholder.
  if (wide.value && (event.target as HTMLImageElement).naturalWidth <= 120) wide.value = false;
}
</script>

<template>
  <section v-if="id" class="s-sec pv">
    <div class="s-wrap">
      <div class="s-head">
        <div><div class="s-kick">{{ kick }}</div><h2 class="s-h2">{{ title }}</h2></div>
        <p v-if="lead" class="s-lead pv-lead">{{ lead }}</p>
      </div>
      <div class="pv-frame">
        <iframe
          v-if="playing"
          :src="`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`"
          :title="title"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
        />
        <button v-else type="button" class="pv-poster" :aria-label="`Putar video: ${title}`" @click="playing = true">
          <img v-if="poster" :src="poster.lg" :srcset="`${poster.sm} 480w, ${poster.md} 960w, ${poster.lg} 1600w`" sizes="(max-width: 1280px) 100vw, 1216px" :alt="poster.alt" loading="lazy" />
          <img v-else :src="thumb" alt="" loading="lazy" @load="checkThumb" @error="wide = false" />
          <span class="pv-play" aria-hidden="true"><Play :size="34" fill="currentColor" /></span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pv-lead { max-width: 420px; }
.pv-frame { position: relative; overflow: hidden; aspect-ratio: 16 / 9; border-radius: 28px; background: var(--ab-ink); }
.pv-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.pv-poster { position: absolute; inset: 0; display: block; width: 100%; height: 100%; padding: 0; cursor: pointer; }
.pv-poster img { width: 100%; height: 100%; object-fit: cover; }
/* A flat veil keeps the play button readable over any photo. */
.pv-poster::after { position: absolute; inset: 0; background: rgba(19, 33, 26, .28); content: ''; transition: background-color .2s; }
.pv-poster:hover::after { background: rgba(19, 33, 26, .12); }
.pv-play { position: absolute; top: 50%; left: 50%; z-index: 1; display: grid; width: 104px; height: 104px; place-items: center; padding-left: 5px; border-radius: 50%; background: var(--ab-sun); color: var(--ab-ink); transform: translate(-50%, -50%); transition: transform .2s; }
.pv-poster:hover .pv-play { transform: translate(-50%, -50%) scale(1.06); }
.pv-poster:focus-visible { outline: 3px solid var(--ab-sun); outline-offset: -6px; }
@media (max-width: 640px) {
  .pv-frame { border-radius: 20px; }
  .pv-play { width: 68px; height: 68px; padding-left: 3px; }
  .pv-play svg { width: 24px; height: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .pv-play, .pv-poster::after { transition: none; }
}
</style>
