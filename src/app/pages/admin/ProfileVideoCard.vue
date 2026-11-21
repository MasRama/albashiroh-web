<script setup lang="ts">
import { fieldError, type PortalSettings } from '../../../features/content/web';
import { MediaImageField } from '../../../features/media/web';
import { AbCard, AbField } from '../../../shared/ui';

/** A portal's profile video: the YouTube link the home page plays, and the picture shown before play is pressed. */
defineProps<{ errors?: Record<string, string[]> }>();
const video = defineModel<PortalSettings['video']>({ required: true });
</script>

<template>
  <AbCard title="Video profil" description="Tampil di halaman depan, tepat di bawah bagian atas. Kosongkan tautan bila belum ada video.">
    <div class="pvc">
      <AbField
        v-model="video.url"
        label="Tautan video YouTube"
        type="url"
        inputmode="url"
        placeholder="https://youtu.be/…"
        hint="Unggah video ke YouTube sekolah, lalu tempel tautannya di sini."
        :error="fieldError(errors, 'settings.video.url')"
        :maxlength="300"
      />
      <MediaImageField
        v-model="video.posterId"
        label="Gambar sampul (opsional)"
        hint="Tanpa gambar sampul, situs memakai gambar dari YouTube."
        :error="fieldError(errors, 'settings.video.posterId')"
        aspect="16 / 9"
      />
    </div>
  </AbCard>
</template>

<style scoped>
.pvc { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 20px; align-items: start; }
@media (max-width: 899px) {
  .pvc { grid-template-columns: minmax(0, 1fr); }
}
</style>
