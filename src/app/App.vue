<script setup lang="ts">
import { onUnmounted } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import AdminShell from './layouts/AdminShell.vue';
import { startLiveUpdates } from './live-updates';

const route = useRoute();
onUnmounted(startLiveUpdates(useRouter()));
</script>

<template>
  <RouterView v-slot="{ Component }">
    <AdminShell v-if="route.meta.admin">
      <component :is="Component" />
    </AdminShell>
    <component v-else :is="Component" />
  </RouterView>
</template>
