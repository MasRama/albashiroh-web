<script setup lang="ts">
/**
 * The Yayasan's logo and name. On a dark ground the logo sits on a white
 * tile, as the schools' logos do, since its green would sink into the forest.
 */
withDefaults(defineProps<{ tone?: 'light' | 'dark'; caption?: string }>(), { tone: 'dark', caption: 'Turen, Malang' });
</script>

<template>
  <span class="brand" :class="`brand--${tone}`">
    <span class="brand-mark"><img src="/brand/logo-yayasan.png" alt="" width="320" height="251" /></span>
    <span class="brand-text">
      <b>Yayasan Bashiroh Robbaniyah</b>
      <small>{{ caption }}</small>
    </span>
  </span>
</template>

<style scoped>
.brand { display: inline-flex; align-items: center; gap: 12px; min-width: 0; }
.brand-mark { display: block; flex: none; height: 42px; }
.brand-mark img { display: block; width: auto; height: 100%; }
.brand-text { min-width: 0; }
.brand-text b { display: block; font-family: var(--ab-display); font-size: 19px; font-weight: 800; letter-spacing: -.03em; line-height: 1.05; }
.brand-text small { display: block; margin-top: 3px; overflow: hidden; color: var(--ab-mute); font-size: 11.5px; font-weight: 600; letter-spacing: .01em; text-overflow: ellipsis; white-space: nowrap; }
.brand--light .brand-mark { height: 42px; padding: 6px 8px; border-radius: 11px; background: #fff; }
.brand--light .brand-text b { color: #fff; }
.brand--light .brand-text small { color: rgba(255, 255, 255, .62); }
</style>
