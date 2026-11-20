import type { ContentType, EntryFile, EntryImage, Portal, PortalSettings, PublicEntryDetail, PublicEntryPage } from '../contract';

/** A portal as the public site reads it: its settings and the photos and files they point at. */
export interface SitePortalData {
  portal: Portal;
  info: { name: string; short: string; path: string };
  settings: PortalSettings;
  images: Record<string, EntryImage>;
  files: Record<string, EntryFile>;
}

export interface SiteListQuery {
  page?: number;
  limit?: number;
  /** Agenda: only from today on, undated last. */
  upcoming?: boolean;
}

/** What a read gives a page: the data, or why there is none (404: not published; 0: offline). */
export type SiteResult<T> = { ok: true; data: T } | { ok: false; status: number };

export interface SiteClient {
  portal(portal: Portal): Promise<SiteResult<SitePortalData>>;
  list(portal: Portal, type: ContentType, query?: SiteListQuery): Promise<SiteResult<PublicEntryPage>>;
  entry(portal: Portal, type: ContentType, slug: string): Promise<SiteResult<PublicEntryDetail>>;
}

/**
 * The public site's reads: plain GETs with no session, so pages stay
 * cacheable and never carry the admin's API helpers.
 */
export function createSiteClient(base = '/api/site', fetcher: typeof fetch = (...args) => fetch(...args)): SiteClient {
  async function read<T>(path: string, query: Record<string, string | undefined> = {}): Promise<SiteResult<T>> {
    const search = new URLSearchParams(Object.entries(query).filter((pair): pair is [string, string] => pair[1] !== undefined));
    try {
      const response = await fetcher(`${base}${path}${search.size ? `?${search}` : ''}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) return { ok: false, status: response.status };
      const body = (await response.json()) as { data: T };
      return { ok: true, data: body.data };
    } catch {
      return { ok: false, status: 0 };
    }
  }
  const at = (...parts: string[]) => `/${parts.map(encodeURIComponent).join('/')}`;
  return {
    portal: (portal) => read(at(portal)),
    list: (portal, type, query = {}) =>
      read(at(portal, type), { page: query.page?.toString(), limit: query.limit?.toString(), upcoming: query.upcoming ? '1' : undefined }),
    entry: async (portal, type, slug) => {
      const result = await read<{ entry: PublicEntryDetail }>(at(portal, type, slug));
      return result.ok ? { ok: true, data: result.data.entry } : result;
    },
  };
}
