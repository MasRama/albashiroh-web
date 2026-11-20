<script setup lang="ts">
/** An on/off switch; `label` names it for screen readers when no visible text sits beside it. */
defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <button
    type="button"
    role="switch"
    class="ab-switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="ab-switch-knob" />
  </button>
</template>

<style scoped>
.ab-switch {
  position: relative;
  flex: none;
  width: 46px;
  height: 28px;
  border-radius: 999px;
  background: #D9D4C7;
  transition: background-color .2s;
}
.ab-switch[aria-checked='true'] { background: var(--ab-smp); }
.ab-switch:disabled { opacity: .5; }
.ab-switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(19, 33, 26, .25);
  transition: transform .2s;
}
.ab-switch[aria-checked='true'] .ab-switch-knob { transform: translateX(18px); }
</style>
