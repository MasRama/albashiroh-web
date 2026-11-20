import { randomUUID } from 'node:crypto';
import { IMAGE_VARIANTS, type ImageVariant, type MediaItem } from '../contract';
import type { AssetStorage } from '../../../shared/storage';
import { classifyUpload, processImage } from './process';
import { deleteMedia, insertMedia } from './repository';

const VARIANTS = Object.keys(IMAGE_VARIANTS) as ImageVariant[];

/** Where an item's files live in storage. */
export function storageKeys(item: Pick<MediaItem, 'id' | 'kind'>): string[] {
  return item.kind === 'image' ? VARIANTS.map((variant) => `media/${item.id}/${variant}.webp`) : [`media/${item.id}/original`];
}

export interface MediaSource {
  /** The file name as the person or the old site gave it. */
  name: string;
  /** The type the sender claims; the bytes decide. */
  type: string;
  data: Buffer;
  alt: string;
  createdBy: string | null;
}

export type StoredMedia =
  | { ok: true; item: MediaItem }
  | { ok: false; code: 'FILE_TOO_LARGE'; maxBytes: number }
  | { ok: false; code: 'INVALID_FILE_TYPE' | 'UPLOAD_FAILED' };

/** Display name for an upload: the file name without its extension, tidied. */
function displayName(filename: string, kind: 'image' | 'file'): string {
  const trimmed = filename.trim().slice(0, 160) || (kind === 'image' ? 'Foto' : 'Dokumen');
  if (kind === 'file') return trimmed;
  const dot = trimmed.lastIndexOf('.');
  return (dot > 0 ? trimmed.slice(0, dot) : trimmed).replace(/[_-]+/g, ' ').trim() || 'Foto';
}

/**
 * Puts one photo or document in the library: the bytes decide what it is,
 * a photo is stored as upright WebP at each width without its metadata, and
 * nothing is left behind in storage when any step fails. The upload route
 * and the import from the old site both store through here.
 */
export async function storeMedia(storage: AssetStorage, source: MediaSource): Promise<StoredMedia> {
  if (source.data.length === 0) return { ok: false, code: 'INVALID_FILE_TYPE' };
  const kind = classifyUpload({ name: source.name, type: source.type, size: source.data.length }, source.data.subarray(0, 16));
  if (!kind.ok) return kind.code === 'FILE_TOO_LARGE' ? { ok: false, code: 'FILE_TOO_LARGE', maxBytes: kind.maxBytes ?? 0 } : { ok: false, code: 'INVALID_FILE_TYPE' };
  const id = randomUUID();
  const written: string[] = [];
  try {
    let width: number | null = null;
    let height: number | null = null;
    let size = source.data.length;
    if (kind.kind === 'image') {
      const processed = await processImage(source.data);
      width = processed.width;
      height = processed.height;
      size = processed.variants.lg.length;
      for (const variant of VARIANTS) {
        const key = `media/${id}/${variant}.webp`;
        await storage.put({ key, data: processed.variants[variant], contentType: 'image/webp' });
        written.push(key);
      }
    } else {
      const key = `media/${id}/original`;
      await storage.put({ key, data: source.data, contentType: kind.mimeType });
      written.push(key);
    }
    const item = insertMedia({
      id,
      kind: kind.kind,
      name: displayName(source.name, kind.kind),
      alt: source.alt.trim().slice(0, 300),
      mimeType: kind.kind === 'image' ? 'image/webp' : kind.mimeType,
      size,
      width,
      height,
      createdBy: source.createdBy,
    });
    return { ok: true, item };
  } catch {
    await Promise.all(written.map((key) => storage.delete(key).catch(() => false)));
    return { ok: false, code: 'UPLOAD_FAILED' };
  }
}

/** Takes a photo or document stored a moment ago back out of the library, files and all. */
export async function discardMedia(storage: AssetStorage, id: string): Promise<void> {
  const removed = deleteMedia(id);
  if (!removed) return;
  await Promise.all(storageKeys(removed).map((key) => storage.delete(key).catch(() => false)));
}
