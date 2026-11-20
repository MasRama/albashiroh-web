import { z } from 'zod';
import { API_REFUSAL_CODES } from '../../shared/security/codes';
import type { PermissionDeclaration } from '../../shared/security/permissions';
import { permissionRules, type AccessRule } from '../../shared/security/access';
import type { ActivityDeclaration } from '../../shared/security/activity';

export const featureName = 'media' as const;
export type FeatureName = typeof featureName;

/**
 * Media is the site's library of uploaded photos and documents. Photos are
 * re-encoded to WebP in three widths, so pages never ship a camera original;
 * documents (PDF and Office files) are kept as uploaded for download.
 */
export const MEDIA_PERMISSIONS = [
  { action: 'view', name: 'Lihat media', description: 'Melihat pustaka foto dan dokumen' },
  { action: 'upload', name: 'Unggah media', description: 'Mengunggah foto dan dokumen serta mengubah keterangannya' },
  { action: 'delete', name: 'Hapus media', description: 'Menghapus foto dan dokumen dari pustaka' },
] as const satisfies readonly PermissionDeclaration[];

export interface MediaAccess {
  readonly view: AccessRule;
  readonly upload: AccessRule;
  readonly delete: AccessRule;
}

export function mediaAccess(resource: string): MediaAccess {
  const rule = permissionRules(resource, MEDIA_PERMISSIONS);
  return { view: rule('view'), upload: rule('upload'), delete: rule('delete') };
}

/** What Media reports to the activity trail. */
export const MEDIA_ACTIVITY = [
  { action: 'uploaded', label: 'Media diunggah', kind: 'create' },
  { action: 'updated', label: 'Keterangan media diubah', kind: 'update' },
  { action: 'deleted', label: 'Media dihapus', kind: 'delete' },
] as const satisfies readonly ActivityDeclaration[];

/** Live update topic: the library changed; open pickers and the library page refetch. */
export const MEDIA_CHANGED_EVENT = 'media.changed';

export const MEDIA_KINDS = ['image', 'file'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** The widths every photo is stored in, as WebP. */
export const IMAGE_VARIANTS = { sm: 480, md: 960, lg: 1600 } as const;
export type ImageVariant = keyof typeof IMAGE_VARIANTS;

export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const FILE_MAX_BYTES = 25 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const FILE_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

/** Where a stored photo or document is served from, outside `/api`. */
export const MEDIA_PUBLIC_PATH = '/media';

export const MEDIA_REFUSAL_CODES = [
  ...API_REFUSAL_CODES,
  'FILE_REQUIRED',
  'FILE_TOO_LARGE',
  'INVALID_FILE_TYPE',
  'UPLOAD_FAILED',
  'MEDIA_NOT_FOUND',
  'STALE_REVISION',
] as const;
export type MediaRefusalCode = (typeof MEDIA_REFUSAL_CODES)[number];

export const mediaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  kind: z.enum(MEDIA_KINDS).optional(),
  q: z.string().trim().max(120).optional(),
});
export type MediaQuery = z.infer<typeof mediaQuerySchema>;

export const mediaUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(160),
  alt: z.string().trim().max(300).default(''),
  revision: z.number().int().min(1),
});
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;

/** One item of the library, as the API answers it. */
export interface MediaItem {
  id: string;
  kind: MediaKind;
  name: string;
  alt: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  /** The address of the medium-width WebP, or of the document. */
  url: string;
  /** Photos only: each stored width. */
  variants: Record<ImageVariant, string> | null;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

/** What a page needs to draw a photo: its widths and its description. */
export interface ImageRef {
  id: string;
  alt: string;
  width: number;
  height: number;
  sm: string;
  md: string;
  lg: string;
}

/** What a page needs to link a document. */
export interface FileRef {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface MediaPage {
  items: MediaItem[];
  total: number;
  page: number;
  limit: number;
}
