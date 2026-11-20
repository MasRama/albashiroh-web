<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import AbSpinner from './AbSpinner.vue';

/**
 * Buttons in the mockups' shapes. primary: orange, the one action a screen
 * asks for. dark: forest, a strong second action. outline: white with a
 * hairline. ghost: text only. danger: red text on white, for removals.
 * With `to` it renders a router link, with `href` a plain link.
 */
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
    size?: 'lg' | 'md' | 'sm';
    block?: boolean;
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit';
    to?: RouteLocationRaw;
    href?: string;
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
);

const classes = computed(() => [
  'ab-button',
  `ab-button--${props.variant}`,
  `ab-button--${props.size}`,
  { 'ab-button--block': props.block },
]);
</script>

<template>
  <RouterLink v-if="to && !disabled" :to="to" :class="classes"><slot /></RouterLink>
  <a v-else-if="href && !disabled" :href="href" :class="classes"><slot /></a>
  <button v-else :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading || undefined">
    <AbSpinner v-if="loading" :size="18" :light="variant === 'primary' || variant === 'dark'" label="Sedang diproses" />
    <slot v-else />
  </button>
</template>

<style scoped>
.ab-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1.5px solid transparent;
  border-radius: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color .15s, border-color .15s, color .15s, transform .1s;
}
.ab-button :deep(svg) { width: 17px; height: 17px; flex: none; stroke-width: 2.2; }
.ab-button:active:not(:disabled) { transform: translateY(1px); }
.ab-button:disabled { opacity: .5; cursor: default; }
.ab-button[aria-busy] { opacity: 1; }
.ab-button--block { display: flex; width: 100%; }
.ab-button--lg { height: 52px; padding: 0 24px; border-radius: 14px; font-size: 15px; }
.ab-button--md { height: 44px; padding: 0 18px; font-size: 14.5px; }
.ab-button--sm { height: 34px; padding: 0 12px; border-radius: 10px; font-size: 13.5px; }
.ab-button--sm :deep(svg) { width: 15px; height: 15px; }
.ab-button--primary { background: var(--ab-sma); color: #fff; }
.ab-button--primary:hover:not(:disabled) { background: var(--ab-sma-deep); }
.ab-button--dark { background: var(--ab-forest); color: #fff; }
.ab-button--dark:hover:not(:disabled) { background: var(--ab-forest-2); }
.ab-button--outline { border-color: var(--ab-line); background: var(--ab-card); color: var(--ab-ink); }
.ab-button--outline:hover:not(:disabled) { border-color: var(--ab-line-strong); }
.ab-button--ghost { padding-inline: 10px; color: var(--ab-ink); }
.ab-button--ghost:hover:not(:disabled) { background: var(--ab-paper-2); }
.ab-button--danger { border-color: var(--ab-line); background: var(--ab-card); color: var(--ab-red); }
.ab-button--danger:hover:not(:disabled) { border-color: var(--ab-red); }
</style>
