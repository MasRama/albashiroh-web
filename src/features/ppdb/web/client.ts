import { createApi, type ApiOptions, type ApiResult } from '../../../shared/ui';
import type { Application, ApplicationPage, ApplicationStatus, Level, PpdbSettings, PpdbSettingsRecord } from '../contract';

export interface ApplicationListQuery {
  level?: Level;
  status?: ApplicationStatus;
  q?: string;
  page?: number;
  limit?: number;
}

export interface PpdbClient {
  list(query?: ApplicationListQuery): Promise<ApiResult<ApplicationPage>>;
  get(id: string): Promise<ApiResult<{ application: Application }>>;
  review(id: string, change: { status: ApplicationStatus; note: string; revision: number }): Promise<ApiResult<{ application: Application }>>;
  remove(id: string): Promise<ApiResult<{ id: string }>>;
  settings(): Promise<ApiResult<{ record: PpdbSettingsRecord }>>;
  saveSettings(settings: PpdbSettings, revision: number): Promise<ApiResult<{ record: PpdbSettingsRecord }>>;
  /** The address of a download of the registrations matching a filter. */
  exportUrl(format: 'csv' | 'xlsx', query?: Omit<ApplicationListQuery, 'page' | 'limit'>): string;
}

/** The committee's PPDB client, built with the session's CSRF helpers by the application. */
export function createPpdbClient(options: ApiOptions, base = '/api/ppdb'): PpdbClient {
  const api = createApi(options, base);
  const at = (...parts: string[]) => `/${parts.map(encodeURIComponent).join('/')}`;
  return {
    list: (query = {}) => api.get('/applications', query),
    get: (id) => api.get(at('applications', id)),
    review: (id, change) => api.patch(at('applications', id), change),
    remove: (id) => api.delete(at('applications', id)),
    settings: () => api.get('/settings'),
    saveSettings: (settings, revision) => api.put('/settings', { settings, revision }),
    exportUrl: (format, query = {}) => api.url('/applications/export', { ...query, format }),
  };
}

/** Indonesian text for each refusal the committee's API can answer with. */
export function ppdbRefusalText(result: { code: string; message: string }): string {
  switch (result.code) {
    case 'APPLICATION_NOT_FOUND':
      return 'Data pendaftar ini sudah dihapus.';
    case 'STALE_REVISION':
      return 'Data ini baru diubah orang lain. Periksa lalu simpan lagi.';
    case 'VALIDATION_ERROR':
      return 'Periksa lagi isian yang ditandai.';
    case 'FORBIDDEN':
      return 'Akun Anda tidak punya izin untuk ini.';
    default:
      return result.message;
  }
}
