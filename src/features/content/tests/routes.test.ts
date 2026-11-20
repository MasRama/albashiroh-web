import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDatabase } from '../../../shared/database';
import type { AccessRule } from '../../../shared/security/access';
import { contentAccess, createContentRoutes, createSiteRoutes, type ContentEntry, type ContentServerHost } from '..';
import type { EntryFile, EntryImage, PortalSettingsRecord, PublicEntry, TypeSummary } from '../contract';

/**
 * Content's routes with a stand-in host: who holds which portal, and a
 * library of two photos and one document.
 */
const SMP_EDITOR = 'smp-editor';
const SMA_EDITOR = 'sma-editor';
const YAYASAN_EDITOR = 'yayasan-editor';
const GRANTS: Record<string, string[]> = {
  [SMP_EDITOR]: ['content.smp'],
  [SMA_EDITOR]: ['content.sma'],
  [YAYASAN_EDITOR]: ['content.yayasan'],
};

const PHOTO = '11111111-1111-4111-8111-111111111111';
const OTHER_PHOTO = '22222222-2222-4222-8222-222222222222';
const DOCUMENT = '33333333-3333-4333-8333-333333333333';
const GONE = '44444444-4444-4444-8444-444444444444';
const image = (id: string): EntryImage => ({ id, alt: 'Foto', width: 1600, height: 900, sm: `/media/${id}/sm.webp`, md: `/media/${id}/md.webp`, lg: `/media/${id}/lg.webp` });
const LIBRARY_IMAGES = new Map([PHOTO, OTHER_PHOTO].map((id) => [id, image(id)]));
const LIBRARY_FILES = new Map<string, EntryFile>([[DOCUMENT, { id: DOCUMENT, name: 'Brosur.pdf', mimeType: 'application/pdf', size: 100, url: `/media/${DOCUMENT}/brosur.pdf` }]]);
const pick = <T>(library: Map<string, T>, ids: readonly string[]) => new Map(ids.filter((id) => library.has(id)).map((id) => [id, library.get(id)!]));

const reports: { action: string; targetLabel?: string | null }[] = [];
const host: ContentServerHost = {
  sessionCookieName: 'sid',
  resolveActor: (token) => (token && GRANTS[token] ? { id: token } : undefined),
  access: contentAccess('content'),
  allows: (actorId, rule: AccessRule) => 'permission' in rule && GRANTS[actorId]?.includes(rule.permission) === true,
  images: (ids) => pick(LIBRARY_IMAGES, ids),
  files: (ids) => pick(LIBRARY_FILES, ids),
  report: (activity) => reports.push(activity),
};
const app = new Hono().route('/api/content', createContentRoutes(host)).route('/api/site', createSiteRoutes(host));

beforeEach(() => {
  getDatabase().prepare('DELETE FROM content_entries').run();
  getDatabase().prepare('DELETE FROM portal_settings').run();
  reports.length = 0;
});

function send(actor: string, method: string, path: string, body?: unknown) {
  return app.request(`/api/content${path}`, {
    method,
    headers: { Cookie: `sid=${actor}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function create(actor: string, path: string, body: Record<string, unknown>): Promise<ContentEntry> {
  const response = await send(actor, 'POST', path, body);
  expect(response.status, await response.clone().text()).toBe(201);
  return ((await response.json()) as { data: { entry: ContentEntry } }).data.entry;
}

const data = async <T>(response: Response): Promise<T> => ((await response.json()) as { data: T }).data;

describe('content entries', () => {
  it('creates news with a clean address, a sanitized body and today as its date once published', async () => {
    const entry = await create(SMP_EDITOR, '/smp/berita', {
      title: 'Peringatan Hari Kemerdekaan RI ke-81',
      summary: 'Upacara dan lomba di lapangan.',
      body: '<h1>Upacara</h1><p onclick="x()">Siswa <b>berbaris</b> <a href="https://kemdikbud.go.id">di sini</a>.</p><script>alert(1)</script><img src="/public/uploads/lama.jpg"><img src="/media/11111111-1111-4111-8111-111111111111/md.webp" alt="Upacara">',
      imageId: PHOTO,
      fileId: DOCUMENT,
      fields: { category: 'Kegiatan', unknown: 'dibuang' },
      status: 'published',
    });
    expect(entry).toMatchObject({
      portal: 'smp',
      type: 'berita',
      slug: 'peringatan-hari-kemerdekaan-ri-ke-81',
      image: { id: PHOTO, md: `/media/${PHOTO}/md.webp` },
      // News carries no document; whatever is sent for it is cleared.
      fileId: null,
      fields: { category: 'Kegiatan' },
      status: 'published',
    });
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entry.body).toBe(
      '<h2>Upacara</h2><p>Siswa <strong>berbaris</strong> <a href="https://kemdikbud.go.id" target="_blank" rel="noopener noreferrer">di sini</a>.</p><img src="/media/11111111-1111-4111-8111-111111111111/md.webp" alt="Upacara" />',
    );
    expect(reports).toEqual([expect.objectContaining({ action: 'content.created', targetLabel: 'SMP · Peringatan Hari Kemerdekaan RI ke-81' })]);
  });

  it('gives a repeated title its own address and refuses an address already in use', async () => {
    await create(SMP_EDITOR, '/smp/berita', { title: 'Kegiatan Pramuka' });
    const second = await create(SMP_EDITOR, '/smp/berita', { title: 'Kegiatan Pramuka' });
    expect(second.slug).toBe('kegiatan-pramuka-2');
    // Another portal may use the same address.
    expect((await create(SMA_EDITOR, '/sma/berita', { title: 'Kegiatan Pramuka' })).slug).toBe('kegiatan-pramuka');

    const taken = await send(SMP_EDITOR, 'POST', '/smp/berita', { title: 'Lain', slug: 'kegiatan-pramuka' });
    expect(taken.status).toBe(422);
    await expect(taken.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR', errors: { slug: ['Alamat ini sudah dipakai entri lain.'] } });
  });

  it('refuses photos and documents that are not in the library, and bad links', async () => {
    const response = await send(SMP_EDITOR, 'POST', '/smp/galeri', { title: 'Lomba', imageId: GONE, fields: { video: 'javascript:alert(1)' } });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { errors: Record<string, string[]> };
    expect(Object.keys(body.errors).sort()).toEqual(['fields.video', 'imageId']);

    const file = await send(SMP_EDITOR, 'POST', '/smp/dokumen', { title: 'Brosur', fileId: GONE });
    await expect(file.json()).resolves.toMatchObject({ errors: { fileId: [expect.stringContaining('tidak ada lagi')] } });
  });

  it('keeps only the types each portal has', async () => {
    expect((await send(SMP_EDITOR, 'GET', '/smp/alumni')).status).toBe(404);
    expect((await send(YAYASAN_EDITOR, 'GET', '/yayasan/ekskul')).status).toBe(404);
    expect((await send(SMA_EDITOR, 'GET', '/sma/alumni')).status).toBe(200);
    expect((await send(SMP_EDITOR, 'GET', '/smp/constructor')).status).toBe(404);
  });

  it('lets each editor reach only their own portal', async () => {
    expect((await app.request('/api/content/smp/berita')).status).toBe(401);
    expect((await send(SMA_EDITOR, 'GET', '/smp/berita')).status).toBe(403);
    expect((await send(SMA_EDITOR, 'POST', '/smp/berita', { title: 'x' })).status).toBe(403);
    expect((await send(YAYASAN_EDITOR, 'GET', '/smp/settings')).status).toBe(403);
  });

  it('saves an edit against the version it was opened at', async () => {
    const entry = await create(SMP_EDITOR, '/smp/prestasi', { title: 'Juara 1 Pencak Silat', fields: { level: 'Kabupaten' } });
    const save = (revision: number, title: string) =>
      send(SMP_EDITOR, 'PATCH', `/smp/prestasi/${entry.id}`, { title, slug: entry.slug, fields: { level: 'Provinsi', student: 'Ahmad' }, imageId: OTHER_PHOTO, revision });
    const saved = await data<{ entry: ContentEntry }>(await save(1, 'Juara 1 Pencak Silat Putra'));
    expect(saved.entry).toMatchObject({ title: 'Juara 1 Pencak Silat Putra', slug: 'juara-1-pencak-silat', fields: { level: 'Provinsi', student: 'Ahmad' }, revision: 2 });

    const stale = await save(1, 'Judul lama');
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({ code: 'STALE_REVISION', current: { title: 'Juara 1 Pencak Silat Putra', revision: 2 } });

    const missing = await send(SMP_EDITOR, 'PATCH', `/smp/prestasi/${GONE}`, { title: 'x', revision: 1 });
    expect(missing.status).toBe(404);
    // An entry is reached only under its own portal and type.
    expect((await send(SMP_EDITOR, 'GET', `/smp/berita/${entry.id}`)).status).toBe(404);
  });

  it('lists news newest first, agenda soonest first, and staff in the order the school sets', async () => {
    const old = await create(SMP_EDITOR, '/smp/berita', { title: 'Lama', date: '2026-01-10', status: 'published' });
    const recent = await create(SMP_EDITOR, '/smp/berita', { title: 'Baru', date: '2026-08-17', status: 'published' });
    const news = await data<{ items: ContentEntry[] }>(await send(SMP_EDITOR, 'GET', '/smp/berita'));
    expect(news.items.map((item) => item.id)).toEqual([recent.id, old.id]);

    const later = await create(SMP_EDITOR, '/smp/agenda', { title: 'Ujian', date: '2026-12-01' });
    const undated = await create(SMP_EDITOR, '/smp/agenda', { title: 'Observasi' });
    const soon = await create(SMP_EDITOR, '/smp/agenda', { title: 'PPDB', date: '2026-11-25' });
    const agenda = await data<{ items: ContentEntry[] }>(await send(SMP_EDITOR, 'GET', '/smp/agenda'));
    expect(agenda.items.map((item) => item.id)).toEqual([soon.id, later.id, undated.id]);

    const a = await create(SMP_EDITOR, '/smp/guru', { title: 'Ustadz A' });
    const b = await create(SMP_EDITOR, '/smp/guru', { title: 'Ustadzah B' });
    const c = await create(SMP_EDITOR, '/smp/guru', { title: 'Ustadz C' });
    const reordered = await send(SMP_EDITOR, 'PUT', '/smp/guru/order', { ids: [c.id, a.id, GONE] });
    await expect(reordered.json()).resolves.toMatchObject({ data: { moved: 2 } });
    const staff = await data<{ items: ContentEntry[] }>(await send(SMP_EDITOR, 'GET', '/smp/guru'));
    expect(staff.items.map((item) => item.id)).toEqual([c.id, a.id, b.id]);
  });

  it('finds entries by text and lists the ones still without a photo', async () => {
    const withPhoto = await create(SMP_EDITOR, '/smp/fasilitas', { title: 'Masjid', imageId: PHOTO });
    const without = await create(SMP_EDITOR, '/smp/fasilitas', { title: 'Asrama putra', summary: 'Kamar 8 santri' });
    // A photo deleted from the library since counts as none.
    getDatabase().prepare('UPDATE content_entries SET image_id = ? WHERE id = ?').run(GONE, withPhoto.id);
    const deleted = await data<{ items: ContentEntry[] }>(await send(SMP_EDITOR, 'GET', '/smp/fasilitas'));
    expect(deleted.items.find((item) => item.id === withPhoto.id)).toMatchObject({ imageId: GONE, image: null });

    const missing = await data<{ items: ContentEntry[]; total: number }>(await send(SMP_EDITOR, 'GET', '/smp/fasilitas?missingImage=1'));
    expect(missing.total).toBe(2);
    getDatabase().prepare('UPDATE content_entries SET image_id = ? WHERE id = ?').run(PHOTO, withPhoto.id);
    const still = await data<{ items: ContentEntry[] }>(await send(SMP_EDITOR, 'GET', '/smp/fasilitas?missingImage=1'));
    expect(still.items.map((item) => item.id)).toEqual([without.id]);

    const found = await data<{ items: ContentEntry[] }>(await send(SMP_EDITOR, 'GET', '/smp/fasilitas?q=santri'));
    expect(found.items.map((item) => item.id)).toEqual([without.id]);
    const wildcard = await data<{ total: number }>(await send(SMP_EDITOR, 'GET', '/smp/fasilitas?q=%25'));
    expect(wildcard.total).toBe(0);
  });

  it('counts each type and its entries without a photo for the portal overview', async () => {
    await create(SMA_EDITOR, '/sma/berita', { title: 'A', status: 'published' });
    await create(SMA_EDITOR, '/sma/berita', { title: 'B', imageId: PHOTO });
    await create(SMA_EDITOR, '/sma/faq', { title: 'Apakah wajib asrama?' });
    const { types } = await data<{ types: TypeSummary[] }>(await send(SMA_EDITOR, 'GET', '/sma/summary'));
    expect(types.find((row) => row.type === 'berita')).toEqual({ type: 'berita', total: 2, published: 1, withoutImage: 1 });
    // Q&A takes no photo, so it never needs one.
    expect(types.find((row) => row.type === 'faq')).toEqual({ type: 'faq', total: 1, published: 0, withoutImage: 0 });
    expect(types.map((row) => row.type)).toContain('alumni');
  });

  it('deletes an entry', async () => {
    const entry = await create(SMP_EDITOR, '/smp/faq', { title: 'Kapan pendaftaran?' });
    expect((await send(SMP_EDITOR, 'DELETE', `/smp/faq/${entry.id}`)).status).toBe(200);
    expect((await send(SMP_EDITOR, 'GET', `/smp/faq/${entry.id}`)).status).toBe(404);
    expect(reports.at(-1)).toMatchObject({ action: 'content.deleted' });
  });
});

describe('portal settings', () => {
  const settings = {
    heroTitle: 'Wujudkan generasi bertaqwa',
    heroImageId: PHOTO,
    misi: ['Menumbuhkan kecintaan kepada Allah SWT.'],
    stats: [{ value: '42', label: 'Hadits Arba\'in' }, { value: '', label: '' }],
    prakata: { name: 'Ustadz Fulan', role: 'Kepala Sekolah', photoId: OTHER_PHOTO, body: '<p>Assalamu\'alaikum</p><iframe src="https://evil"></iframe>' },
    takhosus: '<p>Hanya untuk Yayasan</p>',
    contact: { email: 'info@sekolah.sch.id', whatsapp: '6281234567890' },
    ppdb: { brochureFileId: DOCUMENT },
  };

  it('starts empty, saves once, then refuses a save from an older version', async () => {
    const first = await data<{ record: PortalSettingsRecord }>(await send(SMA_EDITOR, 'GET', '/sma/settings'));
    expect(first.record).toMatchObject({ revision: 0, updatedAt: null, settings: { heroTitle: '', misi: [] } });

    const saved = await data<{ record: PortalSettingsRecord }>(await send(SMA_EDITOR, 'PUT', '/sma/settings', { settings, revision: 0 }));
    expect(saved.record).toMatchObject({
      revision: 1,
      settings: {
        heroTitle: 'Wujudkan generasi bertaqwa',
        stats: [{ value: '42', label: "Hadits Arba'in" }],
        prakata: { body: "<p>Assalamu'alaikum</p>" },
        // The Takhosus page is the Yayasan's.
        takhosus: '',
        contact: { email: 'info@sekolah.sch.id', whatsapp: '6281234567890', address: '' },
      },
      images: { [PHOTO]: { id: PHOTO }, [OTHER_PHOTO]: { id: OTHER_PHOTO } },
      files: { [DOCUMENT]: { name: 'Brosur.pdf' } },
    });

    const stale = await send(SMA_EDITOR, 'PUT', '/sma/settings', { settings, revision: 0 });
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({ code: 'STALE_REVISION', current: { revision: 1 } });
    expect(reports).toEqual([expect.objectContaining({ action: 'content.configured', targetLabel: 'SMA · Pengaturan' })]);
  });

  it('keeps the Yayasan pages on the Yayasan and checks every field', async () => {
    const saved = await data<{ record: PortalSettingsRecord }>(await send(YAYASAN_EDITOR, 'PUT', '/yayasan/settings', { settings, revision: 0 }));
    expect(saved.record.settings.takhosus).toBe('<p>Hanya untuk Yayasan</p>');

    const invalid = await send(YAYASAN_EDITOR, 'PUT', '/yayasan/settings', {
      settings: {
        ...settings,
        heroImageId: GONE,
        // A social link the public site would turn into a script, and one with no scheme at all.
        contact: { email: 'bukan email', whatsapp: '0812-abc', instagram: 'javascript:alert(1)', tiktok: 'tiktok.com/@sekolah', youtube: 'https://youtube.com/@sekolah' },
      },
      revision: 1,
    });
    expect(invalid.status).toBe(422);
    const body = (await invalid.json()) as { errors: Record<string, string[]> };
    expect(Object.keys(body.errors).sort()).toEqual(['settings.contact.email', 'settings.contact.instagram', 'settings.contact.tiktok', 'settings.contact.whatsapp']);

    const gone = await send(YAYASAN_EDITOR, 'PUT', '/yayasan/settings', { settings: { ...settings, heroImageId: GONE }, revision: 1 });
    await expect(gone.json()).resolves.toMatchObject({ errors: { 'settings.heroImageId': [expect.any(String)] } });
  });
});

describe('public site reads', () => {
  it('serves published entries only, and the Yayasan lists news from every portal', async () => {
    await create(SMP_EDITOR, '/smp/berita', { title: 'Kabar SMP', date: '2026-08-01', status: 'published', imageId: PHOTO });
    await create(SMA_EDITOR, '/sma/berita', { title: 'Kabar SMA', date: '2026-09-01', status: 'published' });
    await create(YAYASAN_EDITOR, '/yayasan/berita', { title: 'Draf Yayasan' });
    await create(SMA_EDITOR, '/sma/alumni', { title: 'Alumni', status: 'published' });

    const smp = await data<{ items: PublicEntry[]; total: number }>(await app.request('/api/site/smp/berita'));
    expect(smp.items.map((item) => item.title)).toEqual(['Kabar SMP']);
    expect(smp.items[0]).not.toHaveProperty('legacyNote');
    expect(smp.items[0]).not.toHaveProperty('body');

    const yayasan = await data<{ items: PublicEntry[] }>(await app.request('/api/site/yayasan/berita'));
    expect(yayasan.items.map((item) => [item.portal, item.title])).toEqual([
      ['sma', 'Kabar SMA'],
      ['smp', 'Kabar SMP'],
    ]);

    const detail = await app.request('/api/site/smp/berita/kabar-smp');
    expect(detail.status).toBe(200);
    expect((await data<{ entry: { body: string; image: EntryImage } }>(detail)).entry.image.id).toBe(PHOTO);
    expect((await app.request('/api/site/yayasan/berita/draf-yayasan')).status).toBe(404);
    expect((await app.request('/api/site/smp/alumni')).status).toBe(404);
    expect((await app.request('/api/site/sd/berita')).status).toBe(404);
  });

  it('lists upcoming agenda from today on, undated last', async () => {
    await create(SMP_EDITOR, '/smp/agenda', { title: 'Sudah lewat', date: '2020-01-01', status: 'published' });
    await create(SMP_EDITOR, '/smp/agenda', { title: 'Segera', status: 'published' });
    await create(SMP_EDITOR, '/smp/agenda', { title: 'Wisuda', date: '2099-06-01', status: 'published' });
    const upcoming = await data<{ items: PublicEntry[] }>(await app.request('/api/site/smp/agenda?upcoming=1'));
    expect(upcoming.items.map((item) => item.title)).toEqual(['Wisuda', 'Segera']);
  });

  it("serves a portal's settings with their photos", async () => {
    await send(SMP_EDITOR, 'PUT', '/smp/settings', { settings: { heroTitle: 'Qur\'ani', heroImageId: PHOTO }, revision: 0 });
    const site = await data<{ info: { name: string }; settings: { heroTitle: string }; images: Record<string, EntryImage> }>(await app.request('/api/site/smp'));
    expect(site).toMatchObject({ info: { name: 'SMP IT Al Bashiroh Turen' }, settings: { heroTitle: "Qur'ani" }, images: { [PHOTO]: { id: PHOTO } } });
  });
});
