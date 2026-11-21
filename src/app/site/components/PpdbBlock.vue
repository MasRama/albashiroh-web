<script setup lang="ts">
import { ArrowRight, FileText, MessageCircle } from '@lucide/vue';
import { RouterLink } from 'vue-router';
import { siteRouteName, type SitePortal } from '../../site-map';
import { LOGO } from '../site';

/** The orange PPDB block: one registration for both schools, or a school's own invitation. Its words are the portal's home page texts. */
const props = defineProps<{ portal: SitePortal; kick: string; title: string; text: string; whatsapp?: string | null }>();
const ppdb = (jenjang: 'smp' | 'sma') => ({ name: siteRouteName('yayasan', 'ppdb'), query: { jenjang } });
const school = props.portal === 'yayasan' ? null : props.portal;
</script>

<template>
  <section class="s-sec">
    <div class="s-wrap">
      <div class="s-ppdb">
        <div>
          <div class="s-kick">{{ kick }}</div>
          <h2>{{ title }}</h2>
          <p>{{ text }}</p>
          <p v-if="!school" class="s-ppdb-note"><FileText :size="17" aria-hidden="true" /><span>Brosur dan alur pendaftaran ada di <RouterLink :to="{ name: siteRouteName('yayasan', 'dokumen') }">Download dokumen</RouterLink>.</span></p>
        </div>
        <div class="s-choice">
          <template v-for="level in school ? [school] : (['smp', 'sma'] as const)" :key="level">
            <RouterLink :to="ppdb(level)" class="s-ch">
              <span class="s-ch-logo"><img :src="LOGO[level]" alt="" width="56" height="56" loading="lazy" /></span>
              <span><b>Daftar ke {{ level.toUpperCase() }} IT</b><small>{{ school ? 'Formulir PPDB online' : 'Al Bashiroh Turen' }}</small></span>
              <span class="s-ch-go" aria-hidden="true"><ArrowRight :size="20" /></span>
            </RouterLink>
          </template>
          <a v-if="school && whatsapp" :href="whatsapp" target="_blank" rel="noopener noreferrer" class="s-ch">
            <span class="s-ch-logo"><MessageCircle :size="26" aria-hidden="true" /></span>
            <span><b>Tanya panitia PPDB</b><small>Lewat WhatsApp</small></span>
            <span class="s-ch-go" aria-hidden="true"><ArrowRight :size="20" /></span>
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
