<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router';

/** An inner page's opening block: where it sits, its kicker and headline, and a line about it. */
defineProps<{ kicker: string; title: string; intro?: string; crumbs?: { label: string; to: RouteLocationRaw }[] }>();
</script>

<template>
  <section class="s-pagehead">
    <div class="s-wrap">
      <div class="s-pagehead-box">
        <nav v-if="crumbs?.length" class="s-crumbs" aria-label="Lokasi halaman">
          <template v-for="(crumb, index) in crumbs" :key="index">
            <RouterLink :to="crumb.to">{{ crumb.label }}</RouterLink><span aria-hidden="true">/</span>
          </template>
        </nav>
        <div class="s-kick">{{ kicker }}</div>
        <h1>{{ title }}</h1>
        <p v-if="intro">{{ intro }}</p>
        <slot />
      </div>
    </div>
  </section>
</template>
