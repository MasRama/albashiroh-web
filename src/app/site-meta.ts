import { plainText, type SiteReader } from '../features/content';
import { matchSitePath, SITE_PORTAL_NAMES, sitePages, sitePath, type SitePortal } from './site-map';

/**
 * What the server writes into the page shell before the browser runs, so
 * search engines and link previews (WhatsApp, Facebook) see each page's own
 * title, description and photo, and an unknown address answers 404.
 */
export interface PageMeta {
  status: 200 | 404;
  title: string;
  description: string;
  /** Absolute; null for pages that are not indexed. */
  canonical: string | null;
  image: string | null;
  type: 'website' | 'article';
  index: boolean;
}

export const SITE_DESCRIPTION =
  "Yayasan Bashiroh Robbaniyah menaungi SMP IT dan SMA IT Al Bashiroh di Turen, Malang, dengan program unggulan Takhosus Al-Qur'an 30 juz dan kehidupan asrama.";

/** The picture link previews show when a page has no photo of its own. */
export const SHARE_IMAGE = '/brand/og.png';

const schoolDescription = (portal: SitePortal) =>
  `${SITE_PORTAL_NAMES[portal].name}, sekolah Islam terpadu di bawah Yayasan Bashiroh Robbaniyah, Turen, Kabupaten Malang.`;

function isAdmin(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/login';
}

export function describePage(pathname: string, reader: SiteReader, origin: string): PageMeta {
  const absolute = (path: string) => `${origin}${path}`;
  const fallbackImage = absolute(SHARE_IMAGE);
  if (isAdmin(pathname)) {
    return { status: 200, title: 'Panel admin | Al Bashiroh', description: SITE_DESCRIPTION, canonical: null, image: fallbackImage, type: 'website', index: false };
  }
  const notFound: PageMeta = {
    status: 404,
    title: 'Halaman tidak ditemukan | Al Bashiroh',
    description: SITE_DESCRIPTION,
    canonical: null,
    image: fallbackImage,
    type: 'website',
    index: false,
  };
  const match = matchSitePath(pathname);
  if (!match) return notFound;

  const { portal, page, slug } = match;
  const names = SITE_PORTAL_NAMES[portal];
  const { settings, images } = reader.settings(portal);
  const hero = settings.heroImageId ? images[settings.heroImageId] : undefined;
  const portalImage = hero ? absolute(hero.lg) : fallbackImage;
  const portalDescription = settings.heroIntro || (portal === 'yayasan' ? SITE_DESCRIPTION : schoolDescription(portal));

  if (slug) {
    const entry = page.type ? reader.entry(portal, page.type, slug) : undefined;
    if (!entry) return notFound;
    return {
      status: 200,
      title: `${entry.title} | ${names.short}`,
      description: plainText(entry.summary || entry.body, 160) || portalDescription,
      canonical: absolute(sitePath(portal, page.path, slug)),
      image: entry.image ? absolute(entry.image.lg) : portalImage,
      type: 'article',
      index: true,
    };
  }

  const home = page.key === 'home';
  return {
    status: 200,
    title: home ? (portal === 'yayasan' ? 'Al Bashiroh | Yayasan Bashiroh Robbaniyah' : `${names.name}${settings.tagline ? ` | ${settings.tagline}` : ''}`) : `${page.label} | ${names.name}`,
    description: home ? portalDescription : page.description.replaceAll('{name}', names.name),
    canonical: absolute(sitePath(portal, page.path)),
    image: portalImage,
    type: 'website',
    index: true,
  };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** The built index.html with this page's title and meta tags in its head. */
export function renderShell(template: string, meta: PageMeta): string {
  const tag = (attribute: 'name' | 'property', key: string, value: string) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;
  const head = [
    `<title>${escapeHtml(meta.title)}</title>`,
    tag('name', 'description', meta.description),
    meta.index ? '' : tag('name', 'robots', 'noindex'),
    meta.canonical ? `<link rel="canonical" href="${escapeHtml(meta.canonical)}">` : '',
    tag('property', 'og:site_name', 'Al Bashiroh'),
    tag('property', 'og:locale', 'id_ID'),
    tag('property', 'og:type', meta.type),
    tag('property', 'og:title', meta.title),
    tag('property', 'og:description', meta.description),
    meta.canonical ? tag('property', 'og:url', meta.canonical) : '',
    meta.image ? tag('property', 'og:image', meta.image) : '',
    tag('name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary'),
  ]
    .filter(Boolean)
    .join('\n    ');
  return template.replace(/<title>[\s\S]*?<\/title>/, () => head);
}

const day = (millis: number) => new Date(millis).toISOString().slice(0, 10);

/** Every public page and every published entry with a page of its own. */
export function renderSitemap(reader: SiteReader, origin: string): string {
  const urls: { loc: string; lastmod?: string }[] = [];
  for (const portal of ['yayasan', 'smp', 'sma'] as const) {
    for (const page of sitePages(portal)) urls.push({ loc: `${origin}${sitePath(portal, page.path)}` });
  }
  for (const entry of reader.slugs()) {
    const page = sitePages(entry.portal).find((candidate) => candidate.type === entry.type && candidate.detail);
    if (page) urls.push({ loc: `${origin}${sitePath(entry.portal, page.path, entry.slug)}`, lastmod: day(entry.updatedAt) });
  }
  const body = urls
    .map((url) => `  <url><loc>${escapeHtml(url.loc)}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}</url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** The API stays crawlable: search engines render pages with the content they fetch from /api/site. */
export function renderRobots(origin: string): string {
  return ['User-agent: *', 'Disallow: /admin', 'Disallow: /login', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
}
