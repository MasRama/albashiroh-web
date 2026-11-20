<script setup lang="ts">
/**
 * The Yayasan's mark and name. The Yayasan has no logo file yet, so the mark
 * is its initials on a forest square, as in the approved mockups; swap the
 * square for the logo here once the school sends it.
 */
withDefaults(defineProps<{ tone?: 'light' | 'dark'; caption?: string }>(), { tone: 'dark', caption: 'Yayasan Bashiroh Robbaniyah' });
</script>

<template>
  <span class="brand" :class="`brand--${tone}`">
    <span class="brand-mark" aria-hidden="true">AB</span>
    <span class="brand-text">
      <b>Al Bashiroh</b>
      <small>{{ caption }}</small>
    </span>
  </span>
</template>

<style scoped>
.brand { display: inline-flex; align-items: center; gap: 12px; min-width: 0; }
.brand-mark {
  display: grid;
  flex: none;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 11px;
  background: var(--ab-forest);
  color: #fff;
  font-family: var(--ab-display);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -.02em;
}
.brand-text { min-width: 0; }
.brand-text b { display: block; font-family: var(--ab-display); font-size: 19px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
.brand-text small { display: block; margin-top: 3px; overflow: hidden; color: var(--ab-mute); font-size: 11.5px; font-weight: 600; letter-spacing: .01em; text-overflow: ellipsis; white-space: nowrap; }
.brand--light .brand-mark { background: #fff; color: var(--ab-forest); }
.brand--light .brand-text b { color: #fff; }
.brand--light .brand-text small { color: rgba(255, 255, 255, .62); }
</style>
