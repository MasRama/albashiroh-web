import { createApi, type ApiOptions, type ApiResult } from '../../../shared/ui';
import type {
  ContentEntry,
  ContentType,
  EntryInput,
  EntryPage,
  EntryStatus,
  Portal,
  PortalSettings,
  PortalSettingsRecord,
  TypeSummary,
} from '../contract';

export interface EntryListQuery {
  page?: number;
  limit?: number;
  q?: string;
  status?: EntryStatus;
  missingImage?: boolean;
}

export interface ContentClient {
  summary(portal: Portal): Promise<ApiResult<{ portal: Portal; types: TypeSummary[] }>>;
  list(portal: Portal, type: ContentType, query?: EntryListQuery): Promise<ApiResult<EntryPage>>;
  get(portal: Portal, type: ContentType, id: string): Promise<ApiResult<{ entry: ContentEntry }>>;
  create(portal: Portal, type: ContentType, input: EntryInput): Promise<ApiResult<{ entry: ContentEntry }>>;
  update(portal: Portal, type: ContentType, id: string, input: EntryInput & { revision: number }): Promise<ApiResult<{ entry: ContentEntry }>>;
  remove(portal: Portal, type: ContentType, id: string): Promise<ApiResult<{ id: string }>>;
  reorder(portal: Portal, type: ContentType, ids: string[]): Promise<ApiResult<{ moved: number }>>;
  settings(portal: Portal): Promise<ApiResult<{ record: PortalSettingsRecord }>>;
  saveSettings(portal: Portal, settings: PortalSettings, revision: number): Promise<ApiResult<{ record: PortalSettingsRecord }>>;
}

/** The admin's content client, built with the session's CSRF helpers by the application. */
export function createContentClient(options: ApiOptions, base = '/api/content'): ContentClient {
  const api = createApi(options, base);
  const at = (...parts: string[]) => `/${parts.map(encodeURIComponent).join('/')}`;
  return {
    summary: (portal) => api.get(at(portal, 'summary')),
    list: (portal, type, query = {}) => api.get(at(portal, type), { ...query, missingImage: query.missingImage ? '1' : undefined }),
    get: (portal, type, id) => api.get(at(portal, type, id)),
    create: (portal, type, input) => api.post(at(portal, type), input),
    update: (portal, type, id, input) => api.patch(at(portal, type, id), input),
    remove: (portal, type, id) => api.delete(at(portal, type, id)),
    reorder: (portal, type, ids) => api.put(at(portal, type, 'order'), { ids }),
    settings: (portal) => api.get(at(portal, 'settings')),
    saveSettings: (portal, settings, revision) => api.put(at(portal, 'settings'), { settings, revision }),
  };
}

/** Indonesian text for each refusal the content API can answer with. */
export function contentRefusalText(result: { code: string; message: string }): string {
  switch (result.code) {
    case 'TYPE_NOT_FOUND':
      return 'Jenis konten ini tidak ada di portal tersebut.';
    case 'ENTRY_NOT_FOUND':
      return 'Konten ini sudah dihapus.';
    case 'STALE_REVISION':
      return 'Konten ini baru diubah orang lain. Periksa lalu simpan lagi.';
    case 'VALIDATION_ERROR':
      return 'Periksa lagi isian yang ditandai.';
    case 'FORBIDDEN':
      return 'Akun Anda tidak punya izin untuk portal ini.';
    case 'PAYLOAD_TOO_LARGE':
      return 'Isinya terlalu panjang untuk disimpan sekaligus.';
    default:
      return result.message;
  }
}

/** The first message for a field from a 422's `errors`, keyed as the server names it. */
export function fieldError(errors: Record<string, string[]> | undefined, key: string): string | undefined {
  return errors?.[key]?.[0];
}
