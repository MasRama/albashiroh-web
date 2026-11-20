<script setup lang="ts">
import { computed, onUnmounted } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { adminShell } from './admin-shell';
import SiteLayout from './layouts/SiteLayout.vue';
import { startLiveUpdates } from './live-updates';
import { portalOfPath } from './site-map';

const route = useRoute();
// An unknown address under /smp or /sma still shows in that school's frame.
const sitePortal = computed(() => (route.meta.site ? (route.name === 'not-found' ? portalOfPath(route.path) : route.meta.site.portal) : null));
onUnmounted(startLiveUpdates(useRouter()));
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="adminShell" v-if="route.meta.admin && adminShell">
      <component :is="Component" />
    </component>
    <SiteLayout v-else-if="sitePortal" :portal="sitePortal">
      <component :is="Component" />
    </SiteLayout>
    <component v-else :is="Component" />
  </RouterView>
</template>
