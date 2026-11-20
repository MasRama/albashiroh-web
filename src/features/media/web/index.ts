/** Media's browser surface: the library client, the fields that pick photos and documents, and their empty states. */
export {
  FILE_ACCEPT,
  IMAGE_ACCEPT,
  createMediaClient,
  formatBytes,
  imageSrcset,
  imageUrl,
  mediaRefusalText,
  provideMediaClient,
  useMediaClient,
  type MediaClient,
} from './client';
export { MEDIA_CHANGED_EVENT, MEDIA_PERMISSIONS, mediaAccess } from '../contract';
export type { FileRef, ImageRef, MediaItem, MediaKind, MediaPage } from '../contract';
export { default as MediaFileField } from './components/MediaFileField.vue';
export { default as MediaImageField } from './components/MediaImageField.vue';
export { default as MediaPicker } from './components/MediaPicker.vue';
export { default as MediaThumb } from './components/MediaThumb.vue';
