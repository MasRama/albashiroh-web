import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readSettings } from '../../features/content';
import { getDatabase } from '../../shared/database';
import { createLocalAssetStorage } from '../../shared/storage';
import { importOldSiteFile, whatsappNumber, type PortalImport } from '../old-site-import';
import { app } from '../server';

/**
 * The import from the old school sites, against a made-up database in the
 * old sites' shape (every name, number and text here is invented).
 */
const folder = mkdtempSync(join(tmpdir(), 'old-site-import-test-'));
const oldFile = join(folder, 'old-smp.db');
const storageRoot = join(folder, 'storage');
const storage = createLocalAssetStorage({ root: storageRoot });
const day = (iso: string) => Date.parse(`${iso}T03:00:00Z`);

async function buildOldSite(): Promise<void> {
  const jpeg = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#1E6B52' } }).jpeg().toBuffer();
  const old = new Database(oldFile);
  old.exec(`
    CREATE TABLE posts (id TEXT, title TEXT, slug TEXT, content TEXT, type TEXT, publish_date INTEGER, thumbnail_url TEXT, category TEXT, author TEXT, created_at INTEGER);
    CREATE TABLE galleries (id TEXT, title TEXT, description TEXT, type TEXT, file_url TEXT, embed_url TEXT, layout_order INTEGER, created_at INTEGER);
    CREATE TABLE staff (id TEXT, name TEXT, position TEXT, photo_url TEXT, bio TEXT, created_at INTEGER);
    CREATE TABLE downloads (id TEXT, title TEXT, file_url TEXT, type TEXT, slug TEXT, created_at INTEGER);
    CREATE TABLE faqs (id TEXT, question TEXT, answer TEXT, "order" INTEGER, is_active INTEGER, created_at INTEGER);
    CREATE TABLE school_missions (id TEXT, content TEXT, "order" INTEGER, is_active INTEGER, created_at INTEGER);
    CREATE TABLE school_profile (id TEXT, visi TEXT, misi TEXT, address TEXT, phone TEXT, email TEXT, facebook_url TEXT, instagram_url TEXT, youtube_url TEXT, tiktok_url TEXT, updated_at INTEGER);
    CREATE TABLE admissions (id TEXT, flow_text TEXT);
  `);
  const post = old.prepare('INSERT INTO posts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  post.run('p1', 'Kegiatan Contoh Pertama', 'kegiatan-contoh-pertama', '<p class="ql-align-center">Isi kegiatan contoh.</p><p><br></p><p>Paragraf kedua.</p>', 'blog', day('2025-08-17'), '/uploads/hilang.jpg', 'Kegiatan', 'Admin', day('2025-08-17'));
  const pasted = `<img src="data:image/jpeg;base64,${jpeg.toString('base64')}">`;
  post.run('p2', 'Artikel Dengan Foto', 'artikel-dengan-foto', `<p>Pembuka.</p><p>${pasted}</p><p>Tengah.</p><p>${pasted}</p><p>Penutup.</p>`, 'news', day('2025-09-01'), '/uploads/juga-hilang.jpg', 'null', 'Admin', day('2025-09-01'));
  const gallery = old.prepare('INSERT INTO galleries VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  gallery.run('g1', 'Foto Upacara Contoh', 'Upacara contoh.', 'image', '/uploads/g1.jpg', null, 1, day('2025-08-17'));
  gallery.run('g2', 'Video Profil Contoh', '', 'video', null, 'https://www.youtube.com/watch?v=abcdefghijk', 2, day('2025-08-18'));
  old.prepare('INSERT INTO staff VALUES (?, ?, ?, ?, ?, ?)').run('s1', 'Guru Contoh, S.Pd.', 'Guru Matematika', '/uploads/s1.jpg', '', day('2025-01-01'));
  old.prepare('INSERT INTO downloads VALUES (?, ?, ?, ?, ?, ?)').run('d1', 'Brosur Contoh', '/uploads/brosur.pdf', 'Brosur', 'brosur-contoh', day('2025-01-01'));
  const faq = old.prepare('INSERT INTO faqs VALUES (?, ?, ?, ?, ?, ?)');
  faq.run('f1', 'Apakah ada asrama?', 'Ada.\n\nPutra & putri <terpisah>.', 1, 1, day('2025-01-01'));
  faq.run('f2', 'Pertanyaan lama?', 'Jawaban lama.', 2, 0, day('2025-01-02'));
  const mission = old.prepare('INSERT INTO school_missions VALUES (?, ?, ?, ?, ?)');
  mission.run('m1', 'Misi contoh pertama.', 1, 1, day('2025-01-01'));
  mission.run('m2', 'Misi contoh kedua.', 2, 1, day('2025-01-01'));
  old
    .prepare('INSERT INTO school_profile VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('sp', 'Visi contoh sekolah.', '1. Misi lama satu\n2. Misi lama dua', 'Jl. Contoh No. 1, Turen', '0812-0000-0000', 'info@contoh.sch.id', 'https://facebook.com/contoh?mibextid=abc', 'https://www.instagram.com/contoh?igsh=xyz', '', 'javascript:alert(1)', day('2025-01-01'));
  old.prepare('INSERT INTO admissions VALUES (?, ?)').run('a1', 'Daftar di https://tally.so/contoh, transfer ke rekening contoh.');
  old.close();
}

const titles = (type: string) =>
  (getDatabase().prepare("SELECT title FROM content_entries WHERE portal = 'smp' AND type = ? ORDER BY title").all(type) as { title: string }[]).map((row) => row.title);
const row = (ref: string) =>
  getDatabase().prepare('SELECT id, slug, title, summary, body, image_id AS imageId, status, date, fields, legacy_note AS note FROM content_entries WHERE legacy_ref = ?').get(ref) as
    | { id: string; slug: string; title: string; summary: string; body: string; imageId: string | null; status: string; date: string | null; fields: string; note: string }
    | undefined;
const tally = (report: PortalImport, type: string) => report.types.find((entry) => entry.type === type)!;

let first: PortalImport;
let oldBytes: Buffer;

beforeAll(async () => {
  await buildOldSite();
  oldBytes = readFileSync(oldFile);
  first = await importOldSiteFile('smp', oldFile, storage);
});

afterAll(() => rmSync(folder, { recursive: true, force: true }));

describe('import from the old school site', () => {
  it('brings old articles in with their dates and addresses, without the old editor clutter', () => {
    const article = row('smp:posts:p1')!;
    expect(article).toMatchObject({ slug: 'kegiatan-contoh-pertama', status: 'published', date: '2025-08-17', imageId: null });
    expect(article.body).toBe('<p>Isi kegiatan contoh.</p><p>Paragraf kedua.</p>');
    expect(article.summary).toBe('Isi kegiatan contoh. Paragraf kedua.');
    expect(JSON.parse(article.fields)).toEqual({ category: 'Kegiatan' });
    expect(article.note).toContain('hilang bersama server lama');
    expect(tally(first, 'berita')).toMatchObject({ found: 2, imported: 2, existing: 0, invalid: 0, withoutImage: 1, drafts: 0 });
  });

  it('keeps photos pasted into an old article, the first as the cover and the rest in the body', async () => {
    const article = row('smp:posts:p2')!;
    expect(article.imageId).toMatch(/^[0-9a-f-]{36}$/);
    const [, second] = /<img src="\/media\/([0-9a-f-]{36})\/lg\.webp"/.exec(article.body)!;
    expect(second).not.toBe(article.imageId);
    // The cover leaves the body, so the page does not show it twice in a row.
    expect(article.body).toBe(`<p>Pembuka.</p><p>Tengah.</p><p><img src="/media/${second}/lg.webp" alt="Artikel Dengan Foto" /></p><p>Penutup.</p>`);
    expect(article.body).not.toContain('data:');
    expect(article.note).toContain('diambil dari foto di dalam isi');
    // A category the old site saved as the word "null" is no category.
    expect(JSON.parse(article.fields)).toEqual({});
    expect(first.recoveredPhotos).toBe(2);
    const served = await app.request(`/api/site/smp/berita/artikel-dengan-foto`);
    expect(served.status).toBe(200);
    expect(existsSync(join(storageRoot, 'media', article.imageId!, 'lg.webp'))).toBe(true);
  });

  it('takes gallery photos and documents whose file was lost in as drafts, and keeps videos live', () => {
    expect(row('smp:galleries:g1')).toMatchObject({ status: 'draft', imageId: null });
    expect(row('smp:galleries:g1')!.note).toContain('Unggah fotonya');
    expect(row('smp:galleries:g2')).toMatchObject({ status: 'published', note: '' });
    expect(JSON.parse(row('smp:galleries:g2')!.fields)).toEqual({ video: 'https://www.youtube.com/watch?v=abcdefghijk' });
    expect(row('smp:downloads:d1')).toMatchObject({ status: 'draft', slug: 'brosur-contoh' });
    expect(tally(first, 'galeri')).toMatchObject({ imported: 2, withoutImage: 2, drafts: 1 });
    expect(tally(first, 'dokumen')).toMatchObject({ imported: 1, withoutImage: 0, drafts: 1 });
    expect(tally(first, 'guru')).toMatchObject({ imported: 1, withoutImage: 1 });
    expect(JSON.parse(row('smp:staff:s1')!.fields)).toEqual({ position: 'Guru Matematika' });
  });

  it('turns plain-text answers into safe paragraphs and hidden questions into drafts', () => {
    expect(row('smp:faqs:f1')!.body).toBe('<p>Ada.</p><p>Putra &amp; putri &lt;terpisah&gt;.</p>');
    expect(row('smp:faqs:f2')).toMatchObject({ status: 'draft' });
    expect(tally(first, 'faq')).toMatchObject({ imported: 2, drafts: 1 });
  });

  it('fills empty settings with visi, misi and contact, links without their tracking part', () => {
    const { settings } = readSettings('smp');
    expect(settings.visi).toBe('Visi contoh sekolah.');
    expect(settings.misi).toEqual(['Misi contoh pertama.', 'Misi contoh kedua.']);
    expect(settings.contact).toMatchObject({
      address: 'Jl. Contoh No. 1, Turen',
      phone: '0812-0000-0000',
      whatsapp: '6281200000000',
      email: 'info@contoh.sch.id',
      facebook: 'https://facebook.com/contoh',
      instagram: 'https://www.instagram.com/contoh',
      tiktok: '',
    });
    expect(first.settings).toEqual(expect.arrayContaining(['visi', 'misi', 'contact.whatsapp', 'contact.instagram']));
  });

  it('never imports the old admissions page with its form link and payment details', () => {
    const everything = JSON.stringify(getDatabase().prepare("SELECT * FROM content_entries WHERE portal = 'smp'").all()) + JSON.stringify(readSettings('smp'));
    expect(everything).not.toContain('tally.so');
    expect(everything).not.toContain('rekening');
  });

  it('runs again without duplicating anything or undoing what the school edited', async () => {
    const media = (getDatabase().prepare('SELECT COUNT(*) AS n FROM media').get() as { n: number }).n;
    getDatabase().prepare("UPDATE content_entries SET title = 'Judul Diubah Sekolah' WHERE legacy_ref = 'smp:posts:p1'").run();
    getDatabase()
      .prepare("UPDATE portal_settings SET data = json_set(data, '$.visi', 'Visi baru dari sekolah.', '$.contact.address', ''), revision = revision + 1 WHERE portal = 'smp'")
      .run();

    const again = await importOldSiteFile('smp', oldFile, storage);

    expect(again.types.every((entry) => entry.imported === 0 && entry.existing === entry.found)).toBe(true);
    expect(again.recoveredPhotos).toBe(0);
    expect((getDatabase().prepare('SELECT COUNT(*) AS n FROM media').get() as { n: number }).n).toBe(media);
    expect(titles('berita')).toEqual(['Artikel Dengan Foto', 'Judul Diubah Sekolah']);
    expect(readSettings('smp').settings.visi).toBe('Visi baru dari sekolah.');
    // A field the school cleared counts as empty and is filled again.
    expect(again.settings).toEqual(['contact.address']);
  });

  it('never writes to the old database file', () => {
    expect(readFileSync(oldFile).equals(oldBytes)).toBe(true);
    expect(readdirSync(folder).sort()).toEqual(['old-smp.db', 'storage']);
    expect(readdirSync(tmpdir()).filter((name) => name.startsWith('albashiroh-old-smp-'))).toEqual([]);
  });

  it('refuses a file that does not exist instead of creating one', async () => {
    await expect(importOldSiteFile('sma', join(folder, 'tidak-ada.db'), storage)).rejects.toThrow('not found');
    expect(existsSync(join(folder, 'tidak-ada.db'))).toBe(false);
  });

  it('writes Indonesian phone numbers the way WhatsApp links want them', () => {
    expect(whatsappNumber('0812-3456-7890')).toBe('6281234567890');
    expect(whatsappNumber('+62 812 3456 7890')).toBe('6281234567890');
    expect(whatsappNumber('12')).toBe('');
  });
});
