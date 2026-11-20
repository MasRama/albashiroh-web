import { ref, shallowRef, watchEffect, type Ref } from 'vue';
import {
  createSiteClient,
  type ContentType,
  type EntryImage,
  type Portal,
  type PortalSettings,
  type PublicEntry,
  type PublicEntryPage,
  type SiteListQuery,
  type SitePortalData,
} from '../../features/content/web';
import { SITE_PORTAL_NAMES, type SitePortal } from '../site-map';

/**
 * What every public page shares: the site client, cached portal settings,
 * list loading, and the small formatting rules of the school's pages.
 */
export const siteClient = createSiteClient();

export type Tone = 'yayasan' | 'smp' | 'sma';

/** A portal's colour: SMP green, SMA orange, the Yayasan forest. */
export const TONE: Record<Tone, { accent: string; deep: string; name: string }> = {
  yayasan: { accent: 'var(--ab-forest)', deep: 'var(--ab-forest-2)', name: 'Yayasan' },
  smp: { accent: 'var(--ab-smp)', deep: 'var(--ab-smp-deep)', name: 'SMP' },
  sma: { accent: 'var(--ab-sma)', deep: 'var(--ab-sma-deep)', name: 'SMA' },
};

export const LOGO: Partial<Record<Portal, string>> = { smp: '/brand/logo-smp.png', sma: '/brand/logo-sma.png' };

// Settings change rarely; a visitor moving between pages reads them once a minute at most.
const SETTINGS_TTL = 60_000;
const portalCache = new Map<Portal, { at: number; load: Promise<SitePortalData | null> }>();

export function loadPortal(portal: Portal): Promise<SitePortalData | null> {
  const cached = portalCache.get(portal);
  if (cached && Date.now() - cached.at < SETTINGS_TTL) return cached.load;
  const load = siteClient.portal(portal).then((result) => {
    if (result.ok) return result.data;
    portalCache.delete(portal);
    return null;
  });
  portalCache.set(portal, { at: Date.now(), load });
  return load;
}

/** Drops the cached settings, so the next page reads them fresh (tests, and after the admin saves). */
export function forgetPortals(): void {
  portalCache.clear();
}

/** A portal's settings for a page, refreshed when the page's portal changes. Null while loading or when the server is unreachable. */
export function usePortal(portal: () => Portal): Ref<SitePortalData | null> {
  const data = shallowRef<SitePortalData | null>(null);
  watchEffect(() => {
    const wanted = portal();
    void loadPortal(wanted).then((loaded) => {
      if (portal() === wanted) data.value = loaded;
    });
  });
  return data;
}

export interface ListState {
  page: Ref<PublicEntryPage | null>;
  failed: Ref<boolean>;
}

/** A published list, reloaded when its portal, type or query changes. */
export function useEntries(source: () => { portal: Portal; type: ContentType; query?: SiteListQuery } | null): ListState {
  const page = shallowRef<PublicEntryPage | null>(null);
  const failed = ref(false);
  let ticket = 0;
  watchEffect(() => {
    const wanted = source();
    const mine = (ticket += 1);
    if (!wanted) return;
    void siteClient.list(wanted.portal, wanted.type, wanted.query).then((result) => {
      if (mine !== ticket) return;
      failed.value = !result.ok;
      page.value = result.ok ? result.data : { items: [], total: 0, page: 1, limit: 0 };
    });
  });
  return { page, failed };
}

export function portalImage(data: SitePortalData | null, id: string | null | undefined): EntryImage | null {
  return data && id ? data.images[id] ?? null : null;
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** 2026-08-17 → 17 Agustus 2026. */
export function longDate(ymd: string | null): string {
  if (!ymd) return '';
  const [year, month, day] = ymd.split('-').map(Number);
  return `${day} ${MONTHS[month! - 1]} ${year}`;
}

/** The tile on an agenda row: day and short month, or "Segera" while the date is open. */
export function agendaTile(ymd: string | null): { top: string; bottom: string } {
  if (!ymd) return { top: 'TBA', bottom: 'Segera' };
  const [, month, day] = ymd.split('-').map(Number);
  return { top: String(day), bottom: MONTHS[month! - 1]!.slice(0, 3) };
}

/** The YouTube id in a watch, short or embed link. */
export function youtubeId(url: string | undefined): string | null {
  if (!url) return null;
  const match = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(url);
  return match ? match[1]! : null;
}

/** A WhatsApp chat link from a number written with its country code. */
export function whatsappLink(number: string, text?: string): string | null {
  const digits = number.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function mapEmbed(query: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function mapLink(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** The school a news item came from, for its label on the Yayasan's lists. */
export function levelLabel(entry: Pick<PublicEntry, 'portal'>): string {
  return TONE[entry.portal].name;
}

/** The browser tab title as the page changes; the server wrote the first one. */
export function useTitle(title: () => string | null): void {
  watchEffect(() => {
    const value = title();
    if (value && typeof document !== 'undefined') document.title = value;
  });
}

export function pageTitle(portal: SitePortal, label: string | null, settings?: PortalSettings | null): string {
  const names = SITE_PORTAL_NAMES[portal];
  if (label) return `${label} | ${names.name}`;
  if (portal === 'yayasan') return 'Al Bashiroh | Yayasan Bashiroh Robbaniyah';
  return `${names.name}${settings?.tagline ? ` | ${settings.tagline}` : ''}`;
}

/** "30 juz" → { value: '30', unit: 'juz' }: the big number on a kompetensi block. */
export function splitTarget(target: string): { value: string; unit: string } | null {
  const match = /^(\d+)\s*(.*)$/.exec(target.trim());
  return match ? { value: match[1]!, unit: match[2]! } : null;
}

/** A headline with *starred* words set in the accent colour, as the school types it in the admin. */
export function emphasize(text: string): { text: string; em: boolean }[] {
  return text
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((part) => (part.length > 2 && part.startsWith('*') && part.endsWith('*') ? { text: part.slice(1, -1), em: true } : { text: part.replaceAll('*', ''), em: false }));
}

/** Plain text from the school's sanitized HTML, cut at a word. */
export function textOf(html: string, max = Infinity): string {
  const text = (typeof DOMParser === 'undefined' ? html.replace(/<[^>]*>/g, ' ') : new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).trimEnd()}…`;
}
