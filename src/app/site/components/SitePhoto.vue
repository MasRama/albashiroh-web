<script setup lang="ts">
import type { EntryImage } from '../../../features/content/web';

/**
 * A photo from the library at the width the layout needs, or, when an entry
 * has none, a solid block in the section's colour carrying its title: a
 * missing photo looks designed, never broken.
 */
withDefaults(
  defineProps<{
    image: EntryImage | null | undefined;
    title: string;
    /** The block's colour when there is no photo. */
    tone?: 'forest' | 'smp' | 'sma' | 'sun' | 'ink' | 'paper';
    /** The `sizes` hint for the browser's pick of width. */
    sizes?: string;
    eager?: boolean;
    /** How big the title is set in the empty block. */
    scale?: 's' | 'm' | 'l';
    /** A logo for the empty block's corner, on a white tile, in place of the initials. */
    logo?: string;
  }>(),
  { tone: 'forest', sizes: '(max-width: 640px) 100vw, 50vw', eager: false, scale: 'm' },
);
</script>

<template>
  <img
    v-if="image"
    class="sp sp--img"
    :src="image.md"
    :srcset="`${image.sm} 480w, ${image.md} 960w, ${image.lg} 1600w`"
    :sizes="sizes"
    :width="image.width"
    :height="image.height"
    :alt="image.alt || title"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
  />
  <div v-else class="sp sp--cover" :class="[`sp--${tone}`, `sp--${scale}`]" role="img" :aria-label="title">
    <span v-if="logo" class="sp-mark sp-mark--logo" aria-hidden="true"><img :src="logo" alt="" /></span>
    <span v-else class="sp-mark" aria-hidden="true">AB</span>
    <span class="sp-title" aria-hidden="true">{{ title }}</span>
  </div>
</template>

<style scoped>
.sp { display: block; width: 100%; height: 100%; }
.sp--img { object-fit: cover; }
.sp--cover {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: clamp(16px, 6%, 32px);
  overflow: hidden;
  color: #fff;
}
.sp--forest { background: var(--ab-forest); }
.sp--smp { background: var(--ab-smp); }
.sp--sma { background: var(--ab-sma); }
.sp--ink { background: var(--ab-ink); }
.sp--sun { background: var(--ab-sun); color: var(--ab-ink); }
.sp--paper { background: #EAE5D9; color: var(--ab-ink); }
.sp-mark {
  position: absolute;
  top: clamp(14px, 6%, 26px);
  left: clamp(16px, 6%, 32px);
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, .16);
  font-family: var(--ab-display);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -.02em;
}
.sp--sun .sp-mark, .sp--paper .sp-mark { background: rgba(19, 33, 26, .1); }
.sp-mark--logo, .sp--sun .sp-mark--logo, .sp--paper .sp-mark--logo { display: block; width: auto; height: auto; padding: 8px 11px; border-radius: 14px; background: #fff; }
.sp-mark--logo img { display: block; width: auto; height: 40px; }
.sp-title {
  display: -webkit-box;
  overflow: hidden;
  font-family: var(--ab-display);
  font-weight: 800;
  letter-spacing: -.035em;
  line-height: 1;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
}
.sp--s .sp-title { font-size: clamp(17px, 2.2vw, 22px); -webkit-line-clamp: 3; line-clamp: 3; }
.sp--m .sp-title { font-size: clamp(22px, 3vw, 34px); }
.sp--l .sp-title { font-size: clamp(32px, 4.2vw, 60px); }
</style>
