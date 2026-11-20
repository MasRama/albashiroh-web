/**
 * The public site's pages: one list read by the browser router (routes and
 * menus) and by the server (titles, descriptions, status codes, sitemap). It
 * imports nothing, so both sides can load it.
 *
 * The Yayasan site lives at the root; each school's portal under /smp and
 * /sma. A page with `type` lists that content type; with `detail`, each entry
 * also has its own page at <page>/<slug>.
 */
export type SitePortal = 'yayasan' | 'smp' | 'sma';

export interface SitePage {
  /** Route name part: site-<portal>-<key>. */
  key: string;
  /** Path under the portal; '' is its home. */
  path: string;
  label: string;
  /** Meta description; {name} is the portal's full name. */
  description: string;
  type?: string;
  detail?: boolean;
  portals: readonly SitePortal[];
}

const ALL: readonly SitePortal[] = ['yayasan', 'smp', 'sma'];
const SCHOOLS: readonly SitePortal[] = ['smp', 'sma'];

export const SITE_PAGES = [
  { key: 'home', path: '', label: 'Beranda', description: '', portals: ALL },
  { key: 'profil', path: 'profil', label: 'Profil', description: 'Profil, visi, misi, dan sambutan {name}.', portals: ALL },
  { key: 'takhosus', path: 'takhosus', label: "Takhosus Al-Qur'an", description: "Program Takhosus Al-Qur'an 30 juz di Yayasan Bashiroh Robbaniyah, Turen.", portals: ['yayasan'] },
  { key: 'keasramaan', path: 'keasramaan', label: 'Keasramaan', description: 'Kehidupan asrama, pembinaan ibadah, dan kegiatan harian santri Al Bashiroh.', portals: ['yayasan'] },
  { key: 'akademik', path: 'akademik', label: 'Akademik', description: 'Kurikulum, kalender akademik, dan program belajar {name}.', type: 'akademik', detail: true, portals: SCHOOLS },
  { key: 'ekskul', path: 'ekstrakurikuler', label: 'Ekstrakurikuler', description: 'Kegiatan ekstrakurikuler {name}.', type: 'ekskul', detail: true, portals: SCHOOLS },
  { key: 'prestasi', path: 'prestasi', label: 'Prestasi', description: 'Prestasi siswa {name}.', type: 'prestasi', portals: ALL },
  { key: 'alumni', path: 'alumni', label: 'Alumni', description: 'Kabar alumni {name}: kampus dan karier lulusan.', type: 'alumni', portals: ['sma'] },
  { key: 'faq', path: 'tanya-jawab', label: 'Tanya jawab', description: 'Pertanyaan yang sering ditanyakan tentang {name}.', type: 'faq', portals: SCHOOLS },
  { key: 'fasilitas', path: 'fasilitas', label: 'Fasilitas', description: 'Sarana belajar dan lingkungan {name}.', type: 'fasilitas', portals: ALL },
  { key: 'guru', path: 'guru', label: 'Guru & staf', description: 'Pendidik dan tenaga kependidikan {name}.', type: 'guru', portals: ALL },
  { key: 'berita', path: 'berita', label: 'Berita & artikel', description: 'Berita dan artikel terbaru dari {name}.', type: 'berita', detail: true, portals: ALL },
  { key: 'agenda', path: 'agenda', label: 'Agenda', description: 'Agenda kegiatan {name}.', type: 'agenda', portals: ALL },
  { key: 'galeri', path: 'galeri', label: 'Galeri', description: 'Foto dan video kegiatan {name}.', type: 'galeri', portals: ALL },
  { key: 'dokumen', path: 'dokumen', label: 'Download dokumen', description: 'Brosur, formulir, dan dokumen resmi {name}.', type: 'dokumen', portals: ALL },
  { key: 'kontak', path: 'kontak', label: 'Kontak', description: 'Alamat, telepon, WhatsApp, dan lokasi {name}.', portals: ALL },
  { key: 'ppdb', path: 'ppdb', label: 'PPDB', description: 'Penerimaan peserta didik baru SMP IT dan SMA IT Al Bashiroh Turen: alur, biaya, dan pendaftaran online.', portals: ['yayasan'] },
] as const satisfies readonly SitePage[];

export type SitePageKey = (typeof SITE_PAGES)[number]['key'];

export const SITE_PORTAL_NAMES: Record<SitePortal, { name: string; short: string }> = {
  yayasan: { name: 'Yayasan Bashiroh Robbaniyah', short: 'Al Bashiroh' },
  smp: { name: 'SMP IT Al Bashiroh Turen', short: 'SMP IT Al Bashiroh' },
  sma: { name: 'SMA IT Al Bashiroh Turen', short: 'SMA IT Al Bashiroh' },
};

export function sitePages(portal: SitePortal): SitePage[] {
  return SITE_PAGES.filter((page) => (page.portals as readonly SitePortal[]).includes(portal));
}

export function sitePage(portal: SitePortal, key: string): SitePage | undefined {
  return sitePages(portal).find((page) => page.key === key);
}

/** The address of a portal's page, or of one entry on it. */
export function sitePath(portal: SitePortal, path = '', slug?: string): string {
  return `/${[portal === 'yayasan' ? '' : portal, path, slug ?? ''].filter(Boolean).join('/')}`;
}

/** Where an entry of a type is read: its own page when the type has one, else the page that lists it. */
export function entryPath(portal: SitePortal, type: string, slug: string): string | undefined {
  const page = sitePages(portal).find((candidate) => candidate.type === type);
  if (!page) return undefined;
  return page.detail ? sitePath(portal, page.path, slug) : sitePath(portal, page.path);
}

/** The portal an address belongs to: /smp and /sma and what is under them are the schools', the rest the Yayasan's. */
export function portalOfPath(pathname: string): SitePortal {
  const first = pathname.split('/')[1];
  return first === 'smp' || first === 'sma' ? first : 'yayasan';
}

/** The Yayasan home keeps the name `home`, which the admin's links back to the site use. */
export const siteRouteName = (portal: SitePortal, key: string, detail = false) =>
  portal === 'yayasan' && key === 'home' && !detail ? 'home' : `site-${portal}-${key}${detail ? '-entry' : ''}`;

export interface SiteMatch {
  portal: SitePortal;
  page: SitePage;
  slug?: string;
}

/** Which public page an address is, if any. Trailing slashes are not addresses of their own. */
export function matchSitePath(pathname: string): SiteMatch | undefined {
  const parts = pathname.split('/').filter(Boolean);
  if (pathname !== '/' && pathname.endsWith('/')) return undefined;
  const portal: SitePortal = parts[0] === 'smp' || parts[0] === 'sma' ? parts.shift() as SitePortal : 'yayasan';
  if (parts.length > 2) return undefined;
  const page = sitePages(portal).find((candidate) => candidate.path === (parts[0] ?? ''));
  if (!page) return undefined;
  if (parts.length === 2) return page.detail && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[1]!) ? { portal, page, slug: parts[1] } : undefined;
  return { portal, page };
}
