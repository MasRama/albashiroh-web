import { describe, expect, it } from 'vitest';
import { emptySettings } from '../../features/content/web';
import type { PublicEntryDetail, SiteReader } from '../../features/content';
import { app } from '../server';
import { describePage, renderRobots, renderShell, renderSitemap, SITE_DESCRIPTION } from '../site-meta';
import { entryPath, matchSitePath, sitePath } from '../site-map';

/**
 * Public pages as search engines and link previews see them before the
 * browser runs: each address's title, description and photo, 404 for
 * addresses the site does not have, and the sitemap.
 */
const ORIGIN = 'https://albashiroh.sch.id';
const PHOTO = { id: 'p', alt: 'Upacara', width: 1600, height: 900, sm: '/media/p/sm.webp', md: '/media/p/md.webp', lg: '/media/p/lg.webp' };

const NEWS: PublicEntryDetail = {
  id: 'n1',
  portal: 'smp',
  type: 'berita',
  title: 'Wisuda Tahfidz Angkatan Ketiga',
  slug: 'wisuda-tahfidz',
  summary: '',
  body: '<p>Dua puluh santri <strong>menuntaskan</strong> hafalan 30 juz.</p>',
  image: PHOTO,
  file: null,
  date: '2026-08-01',
  fields: {},
};

function reader(overrides: Partial<SiteReader> = {}): SiteReader {
  return {
    settings: (portal) => ({
      settings: { ...emptySettings(), ...(portal === 'sma' ? { tagline: 'Wujudkan generasi bertaqwa dan berprestasi.', heroIntro: 'SMA Islam Terpadu di Turen.' } : {}) },
      images: {},
    }),
    entry: (portal, type, slug) => (portal === 'smp' && type === 'berita' && slug === NEWS.slug ? NEWS : undefined),
    slugs: () => [
      { portal: 'smp', type: 'berita', slug: 'wisuda-tahfidz', updatedAt: Date.UTC(2026, 7, 2) },
      { portal: 'sma', type: 'prestasi', slug: 'juara-silat', updatedAt: Date.UTC(2026, 7, 3) },
    ],
    ...overrides,
  };
}

describe('public addresses', () => {
  it('knows each portal page and entry page, and nothing else', () => {
    expect(matchSitePath('/')).toMatchObject({ portal: 'yayasan', page: { key: 'home' } });
    expect(matchSitePath('/takhosus')).toMatchObject({ portal: 'yayasan', page: { key: 'takhosus' } });
    expect(matchSitePath('/sma/alumni')).toMatchObject({ portal: 'sma', page: { key: 'alumni' } });
    expect(matchSitePath('/smp/ekstrakurikuler/pramuka')).toMatchObject({ portal: 'smp', page: { key: 'ekskul' }, slug: 'pramuka' });
    // Alumni is the SMA's; Takhosus the Yayasan's; galleries have no entry pages.
    for (const missing of ['/smp/alumni', '/sma/takhosus', '/galeri/foto-1', '/berita/', '/berita/Bad_Slug', '/smp/berita/a/b', '/register']) {
      expect(matchSitePath(missing), missing).toBeUndefined();
    }
  });

  it('builds addresses, sending entries without a page to their list', () => {
    expect(sitePath('yayasan')).toBe('/');
    expect(sitePath('sma', 'tanya-jawab')).toBe('/sma/tanya-jawab');
    expect(entryPath('smp', 'berita', 'wisuda')).toBe('/smp/berita/wisuda');
    expect(entryPath('sma', 'prestasi', 'juara')).toBe('/sma/prestasi');
    expect(entryPath('yayasan', 'ekskul', 'pramuka')).toBeUndefined();
  });
});

describe('page meta', () => {
  it('describes the Yayasan home and a school home from its settings', () => {
    expect(describePage('/', reader(), ORIGIN)).toEqual({
      status: 200,
      title: 'Yayasan Bashiroh Robbaniyah | SMP IT dan SMA IT Al Bashiroh Turen',
      description: SITE_DESCRIPTION,
      canonical: `${ORIGIN}/`,
      image: `${ORIGIN}/brand/og.png`,
      type: 'website',
      index: true,
    });
    expect(describePage('/sma', reader(), ORIGIN)).toMatchObject({
      title: 'SMA IT Al Bashiroh Turen | Wujudkan generasi bertaqwa dan berprestasi.',
      description: 'SMA Islam Terpadu di Turen.',
      canonical: `${ORIGIN}/sma`,
    });
    expect(describePage('/smp/tanya-jawab', reader(), ORIGIN)).toMatchObject({
      title: 'Tanya jawab | SMP IT Al Bashiroh Turen',
      description: 'Pertanyaan yang sering ditanyakan tentang SMP IT Al Bashiroh Turen.',
    });
  });

  it('describes a published entry by its own title, text and photo', () => {
    expect(describePage('/smp/berita/wisuda-tahfidz', reader(), ORIGIN)).toEqual({
      status: 200,
      title: 'Wisuda Tahfidz Angkatan Ketiga | SMP IT Al Bashiroh',
      description: 'Dua puluh santri menuntaskan hafalan 30 juz.',
      canonical: `${ORIGIN}/smp/berita/wisuda-tahfidz`,
      image: `${ORIGIN}/media/p/lg.webp`,
      type: 'article',
      index: true,
    });
  });

  it('answers 404 for unknown addresses and drafts, and keeps the admin out of search', () => {
    for (const path of ['/tidak-ada', '/smp/berita/draf-rahasia', '/sma/alumni/siapa']) {
      expect(describePage(path, reader(), ORIGIN), path).toMatchObject({ status: 404, index: false, canonical: null });
    }
    expect(describePage('/admin/smp', reader(), ORIGIN)).toMatchObject({ status: 200, index: false, title: 'Panel admin | Yayasan Bashiroh Robbaniyah' });
  });

  it('writes the meta into the shell, escaped', () => {
    const shell = '<html><head>\n    <title>Yayasan Bashiroh Robbaniyah</title>\n</head><body><div id="app"></div></body></html>';
    const html = renderShell(shell, { ...describePage('/smp/berita/wisuda-tahfidz', reader(), ORIGIN), title: 'Juara "1" <Silat> & Pidato' });
    expect(html).toContain('<title>Juara &quot;1&quot; &lt;Silat&gt; &amp; Pidato</title>');
    expect(html).toContain('<meta property="og:title" content="Juara &quot;1&quot; &lt;Silat&gt; &amp; Pidato">');
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/smp/berita/wisuda-tahfidz">`);
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/media/p/lg.webp">`);
    expect(html).not.toContain('noindex');
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(renderShell(shell, describePage('/x', reader(), ORIGIN))).toContain('<meta name="robots" content="noindex">');
  });
});

describe('sitemap and robots', () => {
  it('lists every portal page and each entry with a page of its own', () => {
    const xml = renderSitemap(reader(), ORIGIN);
    expect(xml).toContain(`<url><loc>${ORIGIN}/</loc></url>`);
    expect(xml).toContain(`<url><loc>${ORIGIN}/sma/alumni</loc></url>`);
    expect(xml).toContain(`<url><loc>${ORIGIN}/smp/berita/wisuda-tahfidz</loc><lastmod>2026-08-02</lastmod></url>`);
    expect(xml).not.toContain('juara-silat');
    expect(xml).not.toContain('/smp/alumni');
  });

  it('serves both from the app, keeping the admin out and the API crawlable', async () => {
    const robots = await app.request('/robots.txt');
    expect(robots.status).toBe(200);
    const text = await robots.text();
    expect(text).toContain('Disallow: /admin');
    expect(text).not.toContain('/api');
    expect(text).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
    expect(renderRobots(ORIGIN)).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);

    const sitemap = await app.request('/sitemap.xml');
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get('content-type')).toContain('application/xml');
    expect(await sitemap.text()).toMatch(/<loc>https?:\/\/[^<]+\/smp\/tanya-jawab<\/loc>/);
  });
});

describe('trailing slashes', () => {
  it('sends an address with a trailing slash to the one without, keeping its query', async () => {
    for (const [from, to] of [
      ['/berita/', '/berita'],
      ['/smp/', '/smp'],
      ['/ppdb/?jenjang=sma', '/ppdb?jenjang=sma'],
      ['/admin/ppdb/', '/admin/ppdb'],
    ]) {
      const response = await app.request(from!);
      expect(response.status, from).toBe(301);
      expect(response.headers.get('location'), from).toBe(to);
    }
  });

  it('leaves the home page, the API and files alone', async () => {
    expect((await app.request('/')).status).not.toBe(301);
    expect((await app.request('/api/site/smp/')).status).not.toBe(301);
    expect((await app.request('/assets/app.js/')).status).not.toBe(301);
  });
});

