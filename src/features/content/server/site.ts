import { contentType, type ContentType, type EntryImage, type Portal, type PortalSettings, type PublicEntryDetail } from '../contract';
import type { ContentServerHost } from './host';
import { presentPublicDetail, presentSettings } from './present';
import { findPublishedRow, publishedSlugs, readSettings } from './repository';

/**
 * What the application reads from Content to describe a public page before
 * the browser runs: a portal's settings with its photos, a published entry,
 * and every published address for the sitemap. Drafts never show here.
 */
export interface SiteReader {
  settings(portal: Portal): { settings: PortalSettings; images: Record<string, EntryImage> };
  entry(portal: Portal, type: string, slug: string): PublicEntryDetail | undefined;
  slugs(): { portal: Portal; type: ContentType; slug: string; updatedAt: number }[];
}

export function createSiteReader(host: Pick<ContentServerHost, 'images' | 'files'>): SiteReader {
  return {
    settings: (portal) => {
      const { settings, images } = presentSettings(portal, readSettings(portal), host);
      return { settings, images };
    },
    entry: (portal, type, slug) => {
      const def = contentType(type);
      if (!def || !def.portals.includes(portal)) return undefined;
      const row = findPublishedRow(portal, type as ContentType, slug);
      return row ? presentPublicDetail(row, host) : undefined;
    },
    slugs: () => publishedSlugs(),
  };
}
