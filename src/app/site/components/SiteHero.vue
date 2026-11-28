<script setup lang="ts">
import { computed } from 'vue';
import type { EntryImage } from '../../../features/content/web';
import { emphasize } from '../site';
import SitePhoto from './SitePhoto.vue';

/**
 * A home page's opening block: the headline with its accent words, the
 * intro, the calls to action, three figures along the foot, and the photo
 * with a card over its corner. Without a photo the right side is a solid
 * block carrying the portal's name.
 */
const props = defineProps<{
  title: string;
  intro: string;
  stats: { value: string; label: string }[];
  image: EntryImage | null;
  /** The solid block's text when there is no photo. */
  coverTitle: string;
  dark?: boolean;
}>();
const parts = computed(() => emphasize(props.title));
</script>

<template>
  <section class="hero">
    <div class="s-wrap">
      <div class="hero-box" :class="{ 'hero-box--dark': dark }">
        <div class="hero-text">
          <h1><template v-for="(part, index) in parts" :key="index"><em v-if="part.em">{{ part.text }}</em><template v-else>{{ part.text }}</template></template></h1>
          <p>{{ intro }}</p>
          <div class="hero-cta"><slot name="actions" /></div>
          <dl v-if="stats.length" class="hero-foot">
            <div v-for="stat in stats" :key="stat.label + stat.value">
              <dt>{{ stat.label }}</dt>
              <dd>{{ stat.value }}</dd>
            </div>
          </dl>
        </div>
        <div class="hero-pic">
          <div class="hero-photo"><SitePhoto :image="image" :title="coverTitle" tone="sun" scale="l" sizes="(max-width: 640px) 100vw, 48vw" eager /></div>
          <slot name="card" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero { padding-top: 110px; }
/*
 * On a laptop the whole block, headline to figures and the card over the
 * photo, fits the first screen under the navbar, with its lower edge still
 * in view: the height and the type follow the window's height as well as its
 * width. A block whose text needs more room grows instead of clipping it.
 */
.hero-box {
  position: relative;
  display: grid;
  min-height: clamp(500px, calc(100svh - 136px), 660px);
  grid-template-columns: 1.2fr 1fr;
  overflow: hidden;
  border-radius: 32px;
  background: var(--ab-forest);
}
.hero-box--dark { background: var(--ab-ink); }
.hero-text { display: flex; flex-direction: column; padding: clamp(36px, 7svh, 64px) clamp(40px, 4.4vw, 60px) clamp(28px, 5svh, 44px); color: #fff; }
.hero-text h1 { margin: 0; font-family: var(--ab-display); font-size: clamp(42px, min(4.6vw, 7.4svh), 72px); font-weight: 800; letter-spacing: -.035em; line-height: .98; overflow-wrap: anywhere; }
.hero-text h1 em { color: var(--ab-sun); font-style: normal; }
.hero-box--dark h1 em { color: var(--acc); }
.hero-text p { max-width: 520px; margin: clamp(14px, 2.8svh, 24px) 0 0; color: rgba(255, 255, 255, .78); font-size: clamp(16px, 2.5svh, 18.5px); line-height: 1.55; }
.hero-cta { display: flex; flex-wrap: wrap; gap: 12px; margin: clamp(20px, 4svh, 34px) 0 clamp(22px, 4.4svh, 40px); }
.hero-foot { display: flex; margin: auto 0 0; padding-top: 0; border-top: 1px solid rgba(255, 255, 255, .14); }
.hero-foot div { display: flex; flex-direction: column-reverse; margin-right: 28px; padding: clamp(14px, 2.6svh, 20px) 28px 0 0; border-right: 1px solid rgba(255, 255, 255, .14); }
.hero-foot div:last-child { margin-right: 0; border-right: 0; }
.hero-foot dd { margin: 0; font-family: var(--ab-display); font-size: clamp(22px, 3.6svh, 28px); font-weight: 800; letter-spacing: -.03em; line-height: 1; }
.hero-foot dt { margin-top: 4px; color: rgba(255, 255, 255, .66); font-size: 13.5px; font-weight: 600; }
.hero-pic { position: relative; padding: 14px 14px 14px 0; }
.hero-photo { height: 100%; overflow: hidden; border-radius: 22px; }
/* With no photo yet, the block's title sits at the top: the card over the photo's lower corner would hide it. */
.hero-photo :deep(.sp--cover) { justify-content: flex-start; padding-top: calc(clamp(14px, 6%, 26px) + 52px); }
@media (max-width: 960px) {
  .hero-box { min-height: 0; grid-template-columns: 1fr; }
  .hero-text { padding: 56px 40px 36px; }
  .hero-pic { height: 460px; padding: 0 14px 14px; }
}
@media (max-width: 640px) {
  .hero { padding-top: 86px; }
  .hero-box { border-radius: 26px; }
  .hero-text { padding: 36px 22px 26px; }
  .hero-text h1 { font-size: 44px; }
  .hero-text p { margin-top: 18px; font-size: 16px; }
  .hero-cta { flex-direction: column; margin: 26px 0 30px; }
  .hero-foot div { margin-right: 16px; padding: 18px 16px 0 0; }
  .hero-foot dd { font-size: 21px; white-space: nowrap; }
  .hero-foot dt { font-size: 11.5px; line-height: 1.3; }
  .hero-pic { height: 330px; padding: 0 10px 10px; }
  .hero-photo { border-radius: 18px; }
}
</style>
