<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { Eye, EyeOff } from '@lucide/vue';

/**
 * A labelled text field: the label above, a white box with a hairline
 * border, a hint or an error below. A password field carries an eye button
 * that shows what was typed, so a long password can be checked before it is
 * sent.
 */
const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: string | number | null | undefined;
    type?: string;
    inputmode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'search' | 'url';
    placeholder?: string;
    autocomplete?: string;
    error?: string;
    hint?: string;
    multiline?: boolean;
    rows?: number;
    maxlength?: number;
    disabled?: boolean;
    required?: boolean;
    readonly?: boolean;
  }>(),
  { type: 'text', rows: 4 },
);
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>();
const id = useId();
const revealed = ref(false);
const isPassword = computed(() => props.type === 'password');
const inputType = computed(() => (isPassword.value && revealed.value ? 'text' : props.type));
const describedBy = computed(() => (props.error ? `${id}-error` : props.hint ? `${id}-hint` : undefined));

function input(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value);
}
</script>

<template>
  <div class="ab-field" :class="{ 'ab-field--error': error, 'ab-field--disabled': disabled }">
    <label :for="id" class="ab-field-label">{{ label }}<span v-if="required" class="ab-field-required" aria-hidden="true"> *</span></label>
    <div class="ab-field-box">
      <textarea
        v-if="multiline"
        :id="id"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :rows="rows"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="input"
        @blur="emit('blur')"
      />
      <input
        v-else
        :id="id"
        :value="modelValue ?? ''"
        :type="inputType"
        :inputmode="inputmode"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :maxlength="maxlength"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="input"
        @blur="emit('blur')"
      />
      <button
        v-if="isPassword"
        type="button"
        class="ab-field-reveal"
        :aria-label="revealed ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
        :aria-pressed="revealed"
        :disabled="disabled"
        @mousedown.prevent
        @click="revealed = !revealed"
      >
        <EyeOff v-if="revealed" :size="19" />
        <Eye v-else :size="19" />
      </button>
      <slot name="trail" />
    </div>
    <p v-if="error" :id="`${id}-error`" class="ab-field-error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="ab-field-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.ab-field { display: grid; gap: 7px; min-width: 0; }
.ab-field-label { color: var(--ab-ink); font-size: 14px; font-weight: 700; }
.ab-field-required { color: var(--ab-sma); }
.ab-field-box {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 4px 0 14px;
  border: 1.5px solid var(--ab-line);
  border-radius: 12px;
  background: var(--ab-card);
  transition: border-color .15s, box-shadow .15s;
}
.ab-field-box:focus-within { border-color: var(--ab-forest); box-shadow: var(--ab-focus); }
.ab-field input, .ab-field textarea {
  width: 100%;
  min-width: 0;
  padding: 11px 10px 11px 0;
  border: 0;
  outline: 0;
  background: none;
  font-size: 15px;
  line-height: 22px;
}
.ab-field textarea { resize: vertical; }
.ab-field input::placeholder, .ab-field textarea::placeholder { color: var(--ab-faint); }
.ab-field-reveal { display: grid; flex: none; width: 38px; height: 38px; place-items: center; border-radius: 9px; color: var(--ab-mute); }
.ab-field-reveal:hover { background: var(--ab-paper-2); color: var(--ab-ink); }
.ab-field--error .ab-field-box { border-color: var(--ab-red); }
.ab-field--error .ab-field-box:focus-within { box-shadow: 0 0 0 3px rgba(180, 50, 31, .16); }
.ab-field--disabled .ab-field-box { background: var(--ab-paper-2); }
.ab-field-error { margin: 0; color: var(--ab-red); font-size: 13.5px; font-weight: 600; }
.ab-field-hint { margin: 0; color: var(--ab-mute); font-size: 13.5px; }
</style>
