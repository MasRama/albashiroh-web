import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { app } from '../server';
import { csrfHeaders, issueCsrf } from '../../shared/security/tests/helpers';
import { grantRole, signUp } from './personas';

/**
 * Content through the whole application: the editor roles created at first
 * start, Auth's sessions, the CSRF check, photos from Media, and the public
 * reads the site makes.
 */
async function send(cookie: string, path: string, init: { method: string; body?: BodyInit; json?: unknown }) {
  const csrf = await issueCsrf(app, cookie);
  return app.request(path, {
    method: init.method,
    headers: csrfHeaders(csrf, init.json === undefined ? {} : { 'Content-Type': 'application/json' }),
    body: init.json === undefined ? init.body : JSON.stringify(init.json),
  });
}

describe('content in the application', () => {
  it('lets an SMP editor publish news with an uploaded photo, and nothing on the other portals', async () => {
    const editor = await signUp('Editor SMP');
    grantRole(editor.id, 'editor-smp');

    const form = new FormData();
    const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#2F8A1F' } }).jpeg().toBuffer();
    form.append('file', new File([new Uint8Array(jpeg)], 'upacara.jpg', { type: 'image/jpeg' }));
    const uploaded = await send(editor.cookie, '/api/media', { method: 'POST', body: form });
    expect(uploaded.status).toBe(201);
    const photo = ((await uploaded.json()) as { data: { item: { id: string } } }).data.item;

    const created = await send(editor.cookie, '/api/content/smp/berita', {
      method: 'POST',
      json: { title: 'Upacara 17 Agustus', summary: 'Di lapangan sekolah.', body: '<p>Khidmat.</p>', imageId: photo.id, status: 'published' },
    });
    expect(created.status).toBe(201);

    const site = await app.request('/api/site/smp/berita');
    expect(site.status).toBe(200);
    const { items } = ((await site.json()) as { data: { items: { title: string; image: { md: string } }[] } }).data;
    expect(items).toEqual([expect.objectContaining({ title: 'Upacara 17 Agustus', image: expect.objectContaining({ md: `/media/${photo.id}/md.webp` }) })]);
    // The Yayasan's news page carries it too.
    const yayasan = (await (await app.request('/api/site/yayasan/berita')).json()) as { data: { items: { portal: string }[] } };
    expect(yayasan.data.items.map((item) => item.portal)).toEqual(['smp']);

    expect((await send(editor.cookie, '/api/content/sma/berita', { method: 'POST', json: { title: 'x' } })).status).toBe(403);
    expect((await send(editor.cookie, '/api/content/yayasan/settings', { method: 'PUT', json: { settings: {}, revision: 0 } })).status).toBe(403);
    // Removing from the shared library stays with administrators.
    expect((await send(editor.cookie, `/api/media/${photo.id}`, { method: 'DELETE' })).status).toBe(403);
  });

  it('refuses a write without the CSRF token', async () => {
    const editor = await signUp('Editor Yayasan');
    grantRole(editor.id, 'editor-yayasan');
    const response = await app.request('/api/content/yayasan/berita', {
      method: 'POST',
      headers: { Cookie: editor.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Tanpa token' }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'CSRF_INVALID' });
  });

  it('serves the public reads to anyone and answers 404 for unknown portals', async () => {
    expect((await app.request('/api/site/yayasan')).status).toBe(200);
    expect((await app.request('/api/site/sd')).status).toBe(404);
    expect((await app.request('/api/content/smp/summary')).status).toBe(401);
  });
});
