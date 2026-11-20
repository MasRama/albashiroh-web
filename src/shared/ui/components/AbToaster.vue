<script setup lang="ts">
import { dismissToast, toasts } from '../toast';
</script>

<template>
  <div class="ab-toaster" aria-live="polite">
    <TransitionGroup name="ab-toast">
      <button
        v-for="item in toasts"
        :key="item.id"
        type="button"
        class="ab-toast"
        :class="`ab-toast--${item.tone}`"
        @click="dismissToast(item.id)"
      >
        {{ item.text }}
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.ab-toaster {
  position: fixed;
  right: 24px;
  bottom: calc(24px + var(--ab-safe-bottom));
  z-index: 3000;
  display: flex;
  max-width: min(420px, calc(100vw - 32px));
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}
.ab-toast {
  padding: 13px 18px;
  border: 0;
  border-radius: 14px;
  background: var(--ab-ink);
  box-shadow: 0 12px 28px -10px rgba(10, 24, 16, .5);
  color: #fff;
  font: 700 14px/1.4 var(--ab-font);
  text-align: left;
  cursor: pointer;
  pointer-events: auto;
}
.ab-toast--good { background: var(--ab-forest); }
.ab-toast--bad { background: var(--ab-red); }
.ab-toast--warn { background: var(--ab-sun); color: var(--ab-ink); }
.ab-toast-enter-active, .ab-toast-leave-active { transition: opacity .25s, transform .25s; }
.ab-toast-enter-from, .ab-toast-leave-to { opacity: 0; transform: translateY(10px); }
@media (max-width: 719px) {
  .ab-toaster { right: 16px; left: 16px; max-width: none; align-items: stretch; }
}
</style>
