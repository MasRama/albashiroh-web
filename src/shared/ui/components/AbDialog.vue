<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

/**
 * A modal dialog: centred on wide screens, a sheet from the bottom on
 * phones. It closes on the close button, Escape, or a click on the dimmed
 * page, unless `persistent` (while something is being saved). Focus moves
 * into it on open, stays inside while Tab cycles, and returns to where it
 * was on close.
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg';
    persistent?: boolean;
  }>(),
  { size: 'md', persistent: false },
);
const emit = defineEmits<{ close: [] }>();

const id = useId();
const panel = ref<HTMLElement>();
let returnFocus: HTMLElement | null = null;
let openCount = 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function close(): void {
  if (!props.persistent) emit('close');
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    close();
    return;
  }
  if (event.key !== 'Tab' || !panel.value) return;
  const items = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function lock(on: boolean): void {
  const body = document.body;
  const count = Math.max(0, Number(body.dataset.abDialogs ?? '0') + (on ? 1 : -1));
  body.dataset.abDialogs = String(count);
  body.classList.toggle('ab-locked', count > 0);
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      openCount += 1;
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      lock(true);
      await nextTick();
      // The first field, else the first button after the close button.
      const target =
        panel.value?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled])') ??
        panel.value?.querySelector<HTMLElement>('.ab-dialog-body ' + FOCUSABLE) ??
        panel.value;
      target?.focus();
    } else if (openCount > 0) {
      openCount -= 1;
      lock(false);
      returnFocus?.focus?.();
      returnFocus = null;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (openCount > 0) lock(false);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="ab-dialog">
      <div v-if="open" class="ab ab-dialog-layer" @keydown="onKey">
        <div class="ab-dialog-scrim" aria-hidden="true" @click="close" />
        <div
          ref="panel"
          class="ab-dialog"
          :class="`ab-dialog--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`${id}-title`"
          :aria-describedby="description ? `${id}-description` : undefined"
          tabindex="-1"
        >
          <header class="ab-dialog-head">
            <div class="ab-dialog-heading">
              <h2 :id="`${id}-title`" class="ab-dialog-title">{{ title }}</h2>
              <p v-if="description" :id="`${id}-description`" class="ab-dialog-description">{{ description }}</p>
            </div>
            <button type="button" class="ab-dialog-close" aria-label="Tutup" :disabled="persistent" @click="close"><X :size="20" /></button>
          </header>
          <div class="ab-dialog-body"><slot /></div>
          <footer v-if="$slots.footer" class="ab-dialog-foot"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ab-dialog-layer {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  min-height: 0;
  place-items: center;
  padding: 24px;
  background: transparent;
}
.ab-dialog-scrim { position: absolute; inset: 0; background: rgba(10, 24, 16, .5); }
.ab-dialog {
  position: relative;
  display: flex;
  width: 100%;
  max-height: calc(100dvh - 48px);
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
  background: var(--ab-card);
  box-shadow: var(--ab-shadow-modal);
  outline: 0;
}
.ab-dialog--sm { max-width: 440px; }
.ab-dialog--md { max-width: 580px; }
.ab-dialog--lg { max-width: 820px; }
.ab-dialog-head { display: flex; align-items: flex-start; gap: 16px; padding: 22px 22px 0 26px; }
.ab-dialog-heading { flex: 1; min-width: 0; padding-top: 4px; }
.ab-dialog-title { margin: 0; font-family: var(--ab-display); font-size: 24px; font-weight: 800; letter-spacing: -.025em; line-height: 1.1; }
.ab-dialog-description { margin: 6px 0 0; color: var(--ab-mute); font-size: 14.5px; }
.ab-dialog-close { display: grid; flex: none; width: 40px; height: 40px; place-items: center; border-radius: 12px; background: var(--ab-paper-2); color: var(--ab-ink); }
.ab-dialog-close:hover:not(:disabled) { background: var(--ab-line); }
.ab-dialog-body { display: grid; flex: 1; gap: 18px; overflow-y: auto; overscroll-behavior: contain; padding: 22px 26px 26px; }
.ab-dialog-foot { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; padding: 16px 26px; border-top: 1px solid var(--ab-line); background: #FBF9F4; }

.ab-dialog-enter-active, .ab-dialog-leave-active { transition: opacity .2s; }
.ab-dialog-enter-active .ab-dialog, .ab-dialog-leave-active .ab-dialog { transition: transform .25s cubic-bezier(.32, .72, 0, 1); }
.ab-dialog-enter-from, .ab-dialog-leave-to { opacity: 0; }
.ab-dialog-enter-from .ab-dialog, .ab-dialog-leave-to .ab-dialog { transform: translateY(16px); }

@media (max-width: 719px) {
  .ab-dialog-layer { align-items: end; padding: 0; }
  .ab-dialog { max-height: calc(100dvh - var(--ab-safe-top) - 24px); border-radius: 24px 24px 0 0; }
  .ab-dialog-head { padding: 18px 16px 0 20px; }
  .ab-dialog-body { padding: 18px 20px 22px; }
  .ab-dialog-foot { padding: 14px 20px calc(14px + var(--ab-safe-bottom)); }
  .ab-dialog-foot > :deep(*) { flex: 1; }
  .ab-dialog-enter-from .ab-dialog, .ab-dialog-leave-to .ab-dialog { transform: translateY(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .ab-dialog-enter-active .ab-dialog, .ab-dialog-leave-active .ab-dialog { transition: none; }
}
</style>
