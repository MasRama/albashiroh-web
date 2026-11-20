import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLocalAssetStorage, type AssetStorage } from '../../../shared/storage';
import { getDatabase } from '../../../shared/database';
import type { AccessRule } from '../../../shared/security/access';
import { createMediaFileRoutes, createMediaRoutes, mediaAccess, type MediaItem, type MediaServerHost } from '..';

/**
 * Media's routes on their own: a stand-in host decides who is signed in and
 * what they hold, and bytes go to a temporary folder.
 */
const VIEWER = 'viewer-1';
const EDITOR = 'editor-1';
const MANAGER = 'manager-1';
const GRANTS: Record<string, string[]> = {
  [VIEWER]: ['media.view'],
  [EDITOR]: ['media.view', 'media.upload'],
  [MANAGER]: ['media.view', 'media.upload', 'media.delete'],
};

let root: string;
let storage: AssetStorage;
let app: Hono;
const reports: { action: string; targetId?: string | null }[] = [];

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'albashiroh-media-'));
  storage = createLocalAssetStorage({ root });
  const host: MediaServerHost = {
    sessionCookieName: 'sid',
    resolveActor: (token) => (token && GRANTS[token] ? { id: token } : undefined),
    access: mediaAccess('media'),
    allows: (actorId, rule: AccessRule) => 'permission' in rule && GRANTS[actorId]?.includes(rule.permission) === true,
    storage,
    report: (activity) => reports.push(activity),
  };
  app = new Hono().route('/api/media', createMediaRoutes(host)).route('/media', createMediaFileRoutes(host));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

beforeEach(() => {
  getDatabase().prepare('DELETE FROM media').run();
  reports.length = 0;
});

const as = (actor: string) => ({ Cookie: `sid=${actor}` });

async function photo(width: number, height: number, format: 'jpeg' | 'png' = 'jpeg'): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 14, g: 58, b: 39 } } });
  return format === 'png' ? image.png().toBuffer() : image.jpeg().toBuffer();
}

async function upload(actor: string, data: Buffer, name: string, type: string, alt?: string) {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(data)], name, { type }));
  if (alt) form.append('alt', alt);
  return app.request('/api/media', { method: 'POST', body: form, headers: as(actor) });
}

async function uploaded(actor: string, data: Buffer, name: string, type: string, alt?: string): Promise<MediaItem> {
  const response = await upload(actor, data, name, type, alt);
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: { item: MediaItem } }).data.item;
}

const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 1)]);

describe('media library', () => {
  it('stores a photo upright in three WebP widths and serves each to anyone', async () => {
    const item = await uploaded(EDITOR, await photo(2400, 1200), 'kegiatan_pramuka.jpg', 'image/jpeg', 'Siswa berbaris');
    expect(item).toMatchObject({ kind: 'image', name: 'kegiatan pramuka', alt: 'Siswa berbaris', width: 2400, height: 1200, mimeType: 'image/webp' });
    expect(item.variants).toEqual({
      sm: `/media/${item.id}/sm.webp`,
      md: `/media/${item.id}/md.webp`,
      lg: `/media/${item.id}/lg.webp`,
    });

    for (const [variant, width] of [['sm', 480], ['md', 960], ['lg', 1600]] as const) {
      const response = await app.request(`/media/${item.id}/${variant}.webp`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/webp');
      expect(response.headers.get('cache-control')).toContain('immutable');
      const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
      expect(meta).toMatchObject({ format: 'webp', width });
    }
    expect(reports).toEqual([expect.objectContaining({ action: 'media.uploaded', targetId: item.id })]);
  });

  it('never enlarges a small photo', async () => {
    const item = await uploaded(EDITOR, await photo(300, 200, 'png'), 'logo.png', 'image/png');
    const response = await app.request(`/media/${item.id}/lg.webp`);
    expect((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width).toBe(300);
  });

  it('keeps documents as uploaded: PDFs open in the browser, Office files download', async () => {
    const pdf = await uploaded(EDITOR, PDF, 'Brosur SPMB 2026.pdf', 'application/pdf');
    expect(pdf).toMatchObject({ kind: 'file', name: 'Brosur SPMB 2026.pdf', url: `/media/${pdf.id}/brosur-spmb-2026.pdf`, variants: null });
    const opened = await app.request(pdf.url);
    expect(opened.status).toBe(200);
    expect(opened.headers.get('content-type')).toBe('application/pdf');
    expect(opened.headers.get('content-disposition')).toBe('inline; filename="brosur-spmb-2026.pdf"');
    expect(Buffer.from(await opened.arrayBuffer()).equals(PDF)).toBe(true);

    // Browsers often send Office files untyped; the extension and first bytes decide.
    const docx = await uploaded(EDITOR, DOCX, 'Jadwal Ujian.docx', 'application/octet-stream');
    const downloaded = await app.request(docx.url);
    expect(downloaded.headers.get('content-disposition')).toBe('attachment; filename="jadwal-ujian.docx"');

    // A link copied before a rename still works: it moves to the current name.
    const renamed = await app.request(`/api/media/${pdf.id}`, {
      method: 'PATCH',
      headers: { ...as(EDITOR), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Brosur PPDB 2026.pdf', alt: '', revision: pdf.revision }),
    });
    expect(renamed.status).toBe(200);
    const moved = await app.request(pdf.url);
    expect(moved.status).toBe(301);
    expect(moved.headers.get('location')).toBe(`/media/${pdf.id}/brosur-ppdb-2026.pdf`);
    expect(moved.headers.get('cache-control')).toBe('public, max-age=3600');
    expect((await app.request(`/media/${pdf.id}/md.webp`)).status).toBe(404);
  });

  it('keeps a document address ending in its type when the name loses or changes its extension', async () => {
    const pdf = await uploaded(EDITOR, PDF, 'Jadwal UAS.pdf', 'application/pdf');
    const rename = async (name: string, revision: number) => {
      const response = await app.request(`/api/media/${pdf.id}`, {
        method: 'PATCH',
        headers: { ...as(EDITOR), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, alt: '', revision }),
      });
      return ((await response.json()) as { data: { item: { url: string; revision: number } } }).data.item;
    };

    const plain = await rename('Jadwal UAS Final', pdf.revision);
    expect(plain.url).toBe(`/media/${pdf.id}/jadwal-uas-final.pdf`);
    const moved = await app.request(pdf.url);
    expect(moved.status).toBe(301);
    expect(moved.headers.get('location')).toBe(plain.url);
    const opened = await app.request(plain.url);
    expect(opened.status).toBe(200);
    expect(opened.headers.get('content-disposition')).toBe('inline; filename="jadwal-uas-final.pdf"');

    // A name with a dot or a wrong extension still serves under the type's own.
    const odd = await rename('Laporan v1.2.docx', plain.revision);
    expect(odd.url).toBe(`/media/${pdf.id}/laporan-v1-2-docx.pdf`);
    expect((await app.request(`/media/${pdf.id}/laporan-v1-2.docx`)).status).toBe(404);
  });

  it('refuses files whose bytes are not what they claim, and unsupported types', async () => {
    const fake = await upload(EDITOR, Buffer.from('<script>alert(1)</script>'), 'foto.jpg', 'image/jpeg');
    expect(fake.status).toBe(400);
    await expect(fake.json()).resolves.toMatchObject({ code: 'INVALID_FILE_TYPE' });

    const svg = await upload(EDITOR, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo.svg', 'image/svg+xml');
    expect(svg.status).toBe(400);

    const empty = await app.request('/api/media', { method: 'POST', body: new FormData(), headers: as(EDITOR) });
    await expect(empty.json()).resolves.toMatchObject({ code: 'FILE_REQUIRED' });

    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM media').get()).toEqual({ count: 0 });
  });

  it('refuses a photo over 15 MB', async () => {
    const huge = Buffer.alloc(15 * 1024 * 1024 + 1);
    huge.set([0xff, 0xd8, 0xff]);
    const response = await upload(EDITOR, huge, 'besar.jpg', 'image/jpeg');
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('lists newest first, by kind and by search', async () => {
    const first = await uploaded(EDITOR, await photo(64, 64), 'gedung.jpg', 'image/jpeg', 'Gedung asrama putra');
    const second = await uploaded(EDITOR, PDF, 'kalender.pdf', 'application/pdf');
    getDatabase().prepare('UPDATE media SET created_at = created_at - 1000 WHERE id = ?').run(first.id);

    const all = await (await app.request('/api/media', { headers: as(VIEWER) })).json();
    expect(all.data.items.map((item: MediaItem) => item.id)).toEqual([second.id, first.id]);
    expect(all.data.total).toBe(2);

    const images = await (await app.request('/api/media?kind=image', { headers: as(VIEWER) })).json();
    expect(images.data.items.map((item: MediaItem) => item.id)).toEqual([first.id]);

    const found = await (await app.request('/api/media?q=asrama', { headers: as(VIEWER) })).json();
    expect(found.data.items.map((item: MediaItem) => item.id)).toEqual([first.id]);

    const wildcard = await (await app.request('/api/media?q=%25', { headers: as(VIEWER) })).json();
    expect(wildcard.data.total).toBe(0);
  });

  it('edits a name and description against the version it was opened at', async () => {
    const item = await uploaded(EDITOR, await photo(64, 64), 'a.jpg', 'image/jpeg');
    const save = (revision: number, name: string) =>
      app.request(`/api/media/${item.id}`, {
        method: 'PATCH',
        headers: { ...as(EDITOR), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, alt: 'Lapangan', revision }),
      });
    const saved = await save(1, 'Lapangan upacara');
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({ data: { item: { name: 'Lapangan upacara', alt: 'Lapangan', revision: 2 } } });

    const stale = await save(1, 'Nama lama');
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({ code: 'STALE_REVISION', current: { name: 'Lapangan upacara', revision: 2 } });

    const missing = await app.request('/api/media/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      headers: { ...as(EDITOR), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x', alt: '', revision: 1 }),
    });
    expect(missing.status).toBe(404);
  });

  it('deletes the record and its stored bytes', async () => {
    const item = await uploaded(EDITOR, await photo(64, 64), 'a.jpg', 'image/jpeg');
    const removed = await app.request(`/api/media/${item.id}`, { method: 'DELETE', headers: as(MANAGER) });
    expect(removed.status).toBe(200);
    expect((await app.request(`/media/${item.id}/sm.webp`)).status).toBe(404);
    expect(await storage.get(`media/${item.id}/sm.webp`)).toBeUndefined();
    // Nothing of it stays on disk, not even its folder.
    await expect(stat(join(root, 'media', item.id))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(reports.at(-1)).toMatchObject({ action: 'media.deleted', targetId: item.id });
  });

  it('enforces each permission on the server', async () => {
    expect((await app.request('/api/media')).status).toBe(401);
    expect((await upload(VIEWER, await photo(8, 8), 'a.jpg', 'image/jpeg')).status).toBe(403);
    const item = await uploaded(EDITOR, await photo(8, 8), 'a.jpg', 'image/jpeg');
    expect((await app.request(`/api/media/${item.id}`, { method: 'DELETE', headers: as(EDITOR) })).status).toBe(403);
    expect((await app.request('/media/not-an-id/sm.webp')).status).toBe(404);
  });
});
