import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { app } from '../server';
import { csrfHeaders, issueCsrf } from '../../shared/security/tests/helpers';
import { grantPermissions, signUp } from './personas';

/**
 * Media through the whole application: Auth's sessions and permissions, the
 * CSRF check, the upload budget, and public serving at /media next to the
 * built site.
 */
async function send(cookie: string, path: string, init: { method: string; body?: BodyInit; json?: unknown }) {
  const csrf = await issueCsrf(app, cookie);
  return app.request(path, {
    method: init.method,
    headers: csrfHeaders(csrf, init.json === undefined ? {} : { 'Content-Type': 'application/json' }),
    body: init.json === undefined ? init.body : JSON.stringify(init.json),
  });
}

describe('media in the application', () => {
  it('lets a permitted editor upload, anyone view, and only a permitted account delete', async () => {
    const editor = await signUp('Editor Media');
    grantPermissions(editor.id, ['media.view', 'media.upload']);
    const form = new FormData();
    const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#F26300' } }).jpeg().toBuffer();
    form.append('file', new File([jpeg], 'lomba.jpg', { type: 'image/jpeg' }));

    const created = await send(editor.cookie, '/api/media', { method: 'POST', body: form });
    expect(created.status).toBe(201);
    const { item } = ((await created.json()) as { data: { item: { id: string } } }).data;

    const served = await app.request(`/media/${item.id}/md.webp`);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/webp');

    expect((await send(editor.cookie, `/api/media/${item.id}`, { method: 'DELETE' })).status).toBe(403);
    grantPermissions(editor.id, ['media.delete']);
    expect((await send(editor.cookie, `/api/media/${item.id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await app.request(`/media/${item.id}/md.webp`)).status).toBe(404);
  });

  it('refuses a signed-out upload and an account without the permission', async () => {
    const stranger = await signUp('Tanpa Izin');
    expect((await app.request('/api/media')).status).toBe(401);
    expect((await app.request('/api/media', { headers: { Cookie: stranger.cookie } })).status).toBe(403);
  });

  it('answers 404 for /media paths that are not stored files, instead of the site page', async () => {
    const response = await app.request('/media/00000000-0000-0000-0000-000000000000/sm.webp');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type') ?? '').not.toContain('text/html');
  });
});
