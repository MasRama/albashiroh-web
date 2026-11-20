<script setup lang="ts">
import SiteFooter from '../site/components/SiteFooter.vue';
import SiteNav from '../site/components/SiteNav.vue';
import { usePortal } from '../site/site';
import type { SitePortal } from '../site-map';

/** The public site's frame: the floating navbar over the page, and the footer under it. */
const props = defineProps<{ portal: SitePortal }>();
const data = usePortal(() => props.portal);
</script>

<template>
  <div class="ab site" :class="`site--${portal}`">
    <a href="#isi" class="site-skip">Lompat ke isi</a>
    <SiteNav :portal="portal" />
    <main id="isi" tabindex="-1">
      <slot />
    </main>
    <SiteFooter :portal="portal" :data="data" />
  </div>
</template>

<style scoped>
.site { position: relative; overflow-x: clip; }
.site-skip {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 40;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--ab-ink);
  color: #fff;
  font-weight: 700;
  transform: translateY(-200%);
}
.site-skip:focus { transform: none; }
main:focus { outline: none; }
</style>
