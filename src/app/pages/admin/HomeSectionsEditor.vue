<script setup lang="ts">
import { ChevronDown } from '@lucide/vue';
import { computed } from 'vue';
import { fieldError, homeSections, type HomeSettings, type Portal } from '../../../features/content/web';
import { AbField, AbSwitch } from '../../../shared/ui';

/**
 * The home page's sections, top to bottom as on the site: each opens to its
 * texts, and one the school may take off the page carries a switch. A text
 * left empty shows the wording printed in its box.
 */
const props = defineProps<{ portal: Portal; errors?: Record<string, string[]> }>();
const home = defineModel<HomeSettings>({ required: true });
const sections = computed(() => homeSections(props.portal));

const shown = (key: string) => !home.value.hidden.includes(key);
function setShown(key: string, value: boolean): void {
  home.value.hidden = value ? home.value.hidden.filter((entry) => entry !== key) : [...home.value.hidden, key];
}
function setText(key: string, value: string): void {
  if (value) home.value.text[key] = value;
  else delete home.value.text[key];
}
const changed = (key: string) => sections.value.find((section) => section.key === key)!.texts.filter((text) => home.value.text[text.key]).length;
const hasError = (key: string) => Object.keys(props.errors ?? {}).some((path) => path.startsWith(`settings.home.text.${key}.`));
</script>

<template>
  <ul class="hs">
    <li v-for="section in sections" :key="section.key" class="hs-item" :class="{ 'hs-item--off': !shown(section.key) }">
      <details :open="hasError(section.key) || undefined">
        <summary>
          <span class="hs-name">
            <b>{{ section.label }}</b>
            <small v-if="!shown(section.key)">Disembunyikan</small>
            <small v-else-if="changed(section.key)">{{ changed(section.key) }} teks diubah</small>
          </span>
          <ChevronDown class="hs-chevron" :size="20" aria-hidden="true" />
        </summary>
        <div class="hs-body">
          <p class="hs-note">{{ section.note }}</p>
          <div class="hs-fields">
            <AbField
              v-for="text in section.texts"
              :key="text.key"
              :model-value="home.text[text.key] ?? ''"
              :label="text.label"
              :placeholder="text.fallback"
              :multiline="text.multiline"
              :rows="3"
              :maxlength="text.max"
              :error="fieldError(errors, `settings.home.text.${text.key}`)"
              :class="{ 'hs-wide': text.multiline }"
              @update:model-value="setText(text.key, String($event ?? ''))"
            />
          </div>
        </div>
      </details>
      <label v-if="section.hideable" class="hs-switch">
        <span>Tampilkan</span>
        <AbSwitch :model-value="shown(section.key)" :label="`Tampilkan bagian ${section.label}`" @update:model-value="setShown(section.key, $event)" />
      </label>
    </li>
  </ul>
</template>

<style scoped>
.hs { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.hs-item { position: relative; border: 1px solid var(--ab-line); border-radius: 14px; background: var(--ab-card); }
.hs-item--off { background: var(--ab-paper); }
summary { display: flex; min-height: 56px; align-items: center; gap: 12px; padding: 10px 150px 10px 16px; border-radius: 14px; cursor: pointer; list-style: none; }
summary::-webkit-details-marker { display: none; }
summary:focus-visible { outline: 2px solid var(--ab-forest); outline-offset: 2px; }
.hs-name { display: grid; min-width: 0; flex: 1; gap: 1px; }
.hs-name b { font-size: 15px; font-weight: 700; }
.hs-name small { color: var(--ab-mute); font-size: 12.5px; font-weight: 600; }
.hs-item--off .hs-name b { color: var(--ab-mute); }
.hs-chevron { flex: none; color: var(--ab-mute); transition: transform .2s; }
details[open] .hs-chevron { transform: rotate(180deg); }
.hs-switch { position: absolute; top: 14px; right: 16px; display: flex; align-items: center; gap: 10px; color: var(--ab-ink-2); font-size: 13px; font-weight: 600; }
.hs-body { padding: 4px 16px 18px; }
.hs-note { margin: 0 0 14px; color: var(--ab-mute); font-size: 13.5px; }
.hs-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.hs-wide { grid-column: 1 / -1; }
@media (max-width: 719px) {
  summary { padding-right: 76px; }
  .hs-switch span { display: none; }
  .hs-fields { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .hs-chevron { transition: none; }
}
</style>
