<script setup lang="ts">
import { Check, Copy } from 'lucide-vue-next';
import { ref } from 'vue';
import { copyText } from '../copy';
import { showToast } from '../toast';
import AbButton from './AbButton.vue';

/** Copies `text` and says so on the button for a moment. */
const props = withDefaults(defineProps<{ text: string; label?: string; block?: boolean }>(), { label: 'Salin' });
const done = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy(): Promise<void> {
  if (await copyText(props.text)) {
    done.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => (done.value = false), 1800);
  } else {
    showToast('Browser ini tidak mengizinkan menyalin. Pilih teksnya lalu salin manual.', 'warn');
  }
}
</script>

<template>
  <AbButton variant="outline" :block="block" @click="copy">
    <Check v-if="done" :size="17" />
    <Copy v-else :size="17" />
    {{ done ? 'Tersalin' : label }}
  </AbButton>
</template>
