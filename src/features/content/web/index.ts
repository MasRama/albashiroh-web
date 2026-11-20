import { defineAsyncComponent } from 'vue';

/** Content's browser surface: the admin client, the article editor, and the type and portal definitions pages are built from. */
export { contentRefusalText, createContentClient, fieldError, type ContentClient, type EntryListQuery } from './client';
export {
  AGGREGATED_TYPES,
  CONTENT_PERMISSIONS,
  CONTENT_TYPES,
  contentAccess,
  contentType,
  emptySettings,
  PORTAL_INFO,
  PORTALS,
  portalTypes,
  YAYASAN_ONLY_SETTINGS,
} from '../contract';
export type {
  ContentEntry,
  ContentFieldDef,
  ContentType,
  ContentTypeDef,
  EntryFile,
  EntryImage,
  EntryInput,
  EntryStatus,
  Portal,
  PortalSettings,
  PortalSettingsRecord,
  PublicEntry,
  PublicEntryDetail,
  PublicEntryPage,
  TypeSummary,
} from '../contract';

/**
 * The article editor, fetched the first time a page shows it: Tiptap is the
 * largest part of the admin, and pages that only read this boundary (the
 * router, the public site) must not pull it into their bundle.
 */
export const RichTextEditor = defineAsyncComponent(() => import('./components/RichTextEditor.vue'));
