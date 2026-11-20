import sharp from 'sharp';
import {
  FILE_MAX_BYTES,
  FILE_MIME_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  IMAGE_VARIANTS,
  type ImageVariant,
  type MediaKind,
} from '../contract';

const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];

/** The bytes each accepted type starts with: the browser's declared type is only a claim. */
const SIGNATURES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  'application/msword': OLE,
  'application/vnd.ms-excel': OLE,
  'application/vnd.ms-powerpoint': OLE,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ZIP,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ZIP,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ZIP,
};

/** Browsers often send Office files with an empty or generic type; the extension then decides. */
const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function startsWith(buffer: Uint8Array, signature: readonly number[]): boolean {
  return buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);
}

function matchesSignature(buffer: Uint8Array, mimeType: string): boolean {
  const signature = SIGNATURES[mimeType];
  if (!signature || !startsWith(buffer, signature)) return false;
  return mimeType !== 'image/webp' || Buffer.from(buffer.subarray(8, 12)).toString('ascii') === 'WEBP';
}

export type Classified =
  | { ok: true; kind: MediaKind; mimeType: string }
  | { ok: false; code: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE'; maxBytes?: number };

/** Decides what an upload is from its name, declared type, size and first bytes. */
export function classifyUpload(file: { name: string; type: string; size: number }, head: Uint8Array): Classified {
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : '';
  const declared = file.type && file.type !== 'application/octet-stream' ? file.type : EXTENSION_TYPES[extension] ?? '';
  const isImage = (IMAGE_MIME_TYPES as readonly string[]).includes(declared);
  const isFile = (FILE_MIME_TYPES as readonly string[]).includes(declared);
  if ((!isImage && !isFile) || !matchesSignature(head, declared)) return { ok: false, code: 'INVALID_FILE_TYPE' };
  const maxBytes = isImage ? IMAGE_MAX_BYTES : FILE_MAX_BYTES;
  if (file.size > maxBytes) return { ok: false, code: 'FILE_TOO_LARGE', maxBytes };
  return { ok: true, kind: isImage ? 'image' : 'file', mimeType: declared };
}

export interface ProcessedImage {
  width: number;
  height: number;
  variants: Record<ImageVariant, Buffer>;
}

/**
 * Turns an uploaded photo the right way up (phones store rotation as EXIF),
 * drops its metadata (location included), and encodes each stored width as
 * WebP. A photo smaller than a width is not enlarged.
 */
export async function processImage(source: Buffer): Promise<ProcessedImage> {
  const upright = await sharp(source, { limitInputPixels: 60_000_000, failOn: 'error' }).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = upright.info;
  const entries = await Promise.all(
    (Object.entries(IMAGE_VARIANTS) as [ImageVariant, number][]).map(async ([variant, target]) => {
      const encoded = await sharp(upright.data)
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: variant === 'sm' ? 74 : 80, effort: 4 })
        .toBuffer();
      return [variant, encoded] as const;
    }),
  );
  return { width, height, variants: Object.fromEntries(entries) as Record<ImageVariant, Buffer> };
}
