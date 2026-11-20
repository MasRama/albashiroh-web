import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  FILE_MAX_BYTES,
  IMAGE_VARIANTS,
  MEDIA_PUBLIC_PATH,
  mediaQuerySchema,
  mediaUpdateSchema,
  type ImageVariant,
  type MediaItem,
  type MediaPage,
} from '../contract';
import { createGuard, jsonInput, publicRoute, queryInput, type RoutePolicy } from '../../../shared/security';
import type { MediaServerHost } from './host';
import { announceMediaChanged, mediaChangedTopic } from './live';
import { classifyUpload, processImage } from './process';
import { deleteMedia, downloadName, findMedia, insertMedia, listMedia, updateMedia } from './repository';

const VARIANTS = Object.keys(IMAGE_VARIANTS) as ImageVariant[];

function storageKeys(item: Pick<MediaItem, 'id' | 'kind'>): string[] {
  return item.kind === 'image' ? VARIANTS.map((variant) => `media/${item.id}/${variant}.webp`) : [`media/${item.id}/original`];
}

function uploadedFile(value: unknown): File | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Partial<File>;
  return typeof candidate.arrayBuffer === 'function' && typeof candidate.size === 'number' && typeof candidate.type === 'string'
    ? (value as File)
    : undefined;
}

function refuse<C extends string>(context: Context, status: 400 | 404 | 409 | 413, message: string, code: C, extra: object = {}) {
  return context.json({ success: false as const, message, code, ...extra }, status);
}

/** Display name for an upload: the file name without its extension, tidied. */
function displayName(filename: string, kind: 'image' | 'file'): string {
  const trimmed = filename.trim().slice(0, 160) || (kind === 'image' ? 'Foto' : 'Dokumen');
  if (kind === 'file') return trimmed;
  const dot = trimmed.lastIndexOf('.');
  return (dot > 0 ? trimmed.slice(0, dot) : trimmed).replace(/[_-]+/g, ' ').trim() || 'Foto';
}

/**
 * The upload's request budget: the larger file limit plus multipart framing.
 * The type-specific limit is checked once the type is known.
 */
export const MEDIA_ROUTE_POLICIES = [
  { method: 'POST', path: '/', bodyMaxBytes: FILE_MAX_BYTES + 256 * 1024 },
] as const satisfies readonly RoutePolicy[];

export function createMediaRoutes(host: MediaServerHost) {
  mediaChangedTopic(host.access);
  const guard = createGuard(
    (context) => host.resolveActor(getCookie(context, host.sessionCookieName)),
    (actor, rule) => host.allows(actor.id, rule),
  );

  return new Hono()
    .get('/', guard.allow(host.access.view), queryInput(mediaQuerySchema), (context) => {
      const query = context.req.valid('query');
      const { items, total } = listMedia(query);
      return context.json({
        success: true as const,
        message: 'OK',
        data: { items, total, page: query.page, limit: query.limit } satisfies MediaPage,
      });
    })
    .post('/', guard.allow(host.access.upload), async (context) => {
      const actor = guard.actor(context);
      let body: Record<string, string | File | (string | File)[]>;
      try {
        body = await context.req.parseBody();
      } catch {
        return refuse(context, 400, 'A file is required', 'FILE_REQUIRED');
      }
      const file = uploadedFile(body.file);
      if (!file || file.size === 0) return refuse(context, 400, 'A file is required', 'FILE_REQUIRED');
      const source = Buffer.from(await file.arrayBuffer());
      const kind = classifyUpload(file, source.subarray(0, 16));
      if (!kind.ok) {
        return kind.code === 'FILE_TOO_LARGE'
          ? refuse(context, 413, `File too large (max ${Math.round((kind.maxBytes ?? 0) / 1024 / 1024)}MB)`, 'FILE_TOO_LARGE')
          : refuse(context, 400, 'Only JPG, PNG or WebP photos and PDF or Office documents are accepted', 'INVALID_FILE_TYPE');
      }
      const alt = typeof body.alt === 'string' ? body.alt.trim().slice(0, 300) : '';
      const id = randomUUID();
      const written: string[] = [];
      try {
        let width: number | null = null;
        let height: number | null = null;
        let size = source.length;
        if (kind.kind === 'image') {
          const processed = await processImage(source);
          width = processed.width;
          height = processed.height;
          size = processed.variants.lg.length;
          for (const variant of VARIANTS) {
            const key = `media/${id}/${variant}.webp`;
            await host.storage.put({ key, data: processed.variants[variant], contentType: 'image/webp' });
            written.push(key);
          }
        } else {
          const key = `media/${id}/original`;
          await host.storage.put({ key, data: source, contentType: kind.mimeType });
          written.push(key);
        }
        const item = insertMedia({
          id,
          kind: kind.kind,
          name: displayName(file.name, kind.kind),
          alt,
          mimeType: kind.kind === 'image' ? 'image/webp' : kind.mimeType,
          size,
          width,
          height,
          createdBy: actor.id,
        });
        host.report({ action: 'media.uploaded', resource: 'media', actorId: actor.id, targetId: id, targetLabel: item.name });
        announceMediaChanged(host.access);
        return context.json({ success: true as const, message: 'Uploaded', data: { item } }, 201);
      } catch {
        await Promise.all(written.map((key) => host.storage.delete(key).catch(() => false)));
        return refuse(context, 400, 'The file could not be processed', 'UPLOAD_FAILED');
      }
    })
    .patch('/:id', guard.allow(host.access.upload), jsonInput(mediaUpdateSchema), (context) => {
      const actor = guard.actor(context);
      const result = updateMedia(context.req.param('id'), context.req.valid('json'));
      if (result.status === 'missing') return refuse(context, 404, 'Media not found', 'MEDIA_NOT_FOUND');
      if (result.status === 'stale') {
        return refuse(context, 409, 'Someone else changed this item since you opened it', 'STALE_REVISION', { current: result.item });
      }
      host.report({ action: 'media.updated', resource: 'media', actorId: actor.id, targetId: result.item.id, targetLabel: result.item.name });
      announceMediaChanged(host.access);
      return context.json({ success: true as const, message: 'Saved', data: { item: result.item } });
    })
    .delete('/:id', guard.allow(host.access.delete), async (context) => {
      const actor = guard.actor(context);
      const removed = deleteMedia(context.req.param('id'));
      if (!removed) return refuse(context, 404, 'Media not found', 'MEDIA_NOT_FOUND');
      // The row is gone, so the public path already answers 404; the bytes go best-effort.
      await Promise.all(storageKeys(removed).map((key) => host.storage.delete(key).catch(() => false)));
      host.report({ action: 'media.deleted', resource: 'media', actorId: actor.id, targetId: removed.id, targetLabel: removed.name });
      announceMediaChanged(host.access);
      return context.json({ success: true as const, message: 'Deleted', data: { id: removed.id } });
    });
}

const IMMUTABLE = 'public, max-age=31536000, immutable';
const extension = (file: string) => file.slice(file.lastIndexOf('.') + 1).toLowerCase();

/**
 * Serves stored photos and documents to anyone at `/media/<id>/<file>`. An
 * id never changes content (a replacement is a new upload), so responses are
 * cached for good. Documents keep their type; PDFs open in the browser,
 * Office files download.
 */
export function createMediaFileRoutes(host: Pick<MediaServerHost, 'storage'>) {
  return new Hono().get('/:id/:file', publicRoute, async (context) => {
    const id = context.req.param('id');
    const file = context.req.param('file');
    if (!/^[0-9a-f-]{36}$/.test(id)) return context.notFound();
    const item = findMedia(id);
    if (!item) return context.notFound();
    let key: string;
    let contentType: string;
    const headers: Record<string, string> = { 'Cache-Control': IMMUTABLE };
    if (item.kind === 'image') {
      const variant = file.replace(/\.webp$/, '') as ImageVariant;
      if (!file.endsWith('.webp') || !VARIANTS.includes(variant)) return context.notFound();
      key = `media/${id}/${variant}.webp`;
      contentType = 'image/webp';
    } else {
      const name = downloadName(item.name, item.mimeType);
      if (file !== name) {
        // A link copied before a rename (same document, same type's extension) moves to the current name.
        if (extension(file) !== extension(name)) return context.notFound();
        // Cached for an hour only: the name may change again.
        context.header('Cache-Control', 'public, max-age=3600');
        return context.redirect(`${MEDIA_PUBLIC_PATH}/${id}/${name}`, 301);
      }
      key = `media/${id}/original`;
      contentType = item.mimeType;
      headers['Content-Disposition'] = `${item.mimeType === 'application/pdf' ? 'inline' : 'attachment'}; filename="${name}"`;
    }
    const stored = await host.storage.get(key).catch(() => undefined);
    if (!stored) return context.notFound();
    return new Response(Buffer.from(stored.data), { headers: { ...headers, 'Content-Type': contentType, 'Content-Length': String(stored.size) } });
  });
}
