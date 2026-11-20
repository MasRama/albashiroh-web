/**
 * A small JSON client for the app's `{ success, message, data }` envelope.
 * It never throws for a refusal: pages branch on `ok` and `code` and show
 * `message`. Feature clients build one with the session's CSRF helpers, so
 * this module stays business-neutral and browser-safe.
 */
export type ApiResult<T> =
  | { ok: true; status: number; message: string; data: T }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      errors?: Record<string, string[]>;
      /** What a 409 `STALE_REVISION` carries: the record as it is now. */
      current?: unknown;
    };

export interface ApiOptions {
  ensureToken(): Promise<unknown>;
  headers(headers?: Record<string, string>): Record<string, string>;
}

/** Query parameters; empty, null, and undefined values are left out. */
export type Query = object;

export interface Api {
  get<T>(path: string, query?: Query): Promise<ApiResult<T>>;
  post<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  put<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  patch<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  delete<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  upload<T>(path: string, form: FormData): Promise<ApiResult<T>>;
  /** The address of a file or export under this client, for links and downloads. */
  url(path: string, query?: Query): string;
}

const NETWORK_MESSAGE = 'Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.';

let unauthorized: (() => void) | undefined;

/** Called once when any request answers 401: the shell sends the user back to sign in. */
export function onUnauthorized(handler: () => void): void {
  unauthorized = handler;
}

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query) as [string, unknown][]) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}${path.includes('?') ? '&' : '?'}${text}` : path;
}

async function settle<T>(response: Response): Promise<ApiResult<T>> {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    // A proxy error page or an empty body still gets a readable refusal.
  }
  const message = typeof payload.message === 'string' ? payload.message : response.statusText || 'Permintaan gagal';
  if (response.ok && payload.success !== false) {
    return { ok: true, status: response.status, message, data: (payload.data ?? {}) as T };
  }
  if (response.status === 401) unauthorized?.();
  return {
    ok: false,
    status: response.status,
    code: typeof payload.code === 'string' ? payload.code : `HTTP_${response.status}`,
    message,
    errors: payload.errors as Record<string, string[]> | undefined,
    current: payload.current,
  };
}

export function createApi(options: ApiOptions, base: string): Api {
  const root = base.replace(/\/$/, '');
  const address = (path: string) => (path === '' || path === '/' ? root : `${root}${path.startsWith('/') ? path : `/${path}`}`);

  async function send<T>(method: string, path: string, init: { body?: BodyInit; json?: boolean; query?: Query } = {}): Promise<ApiResult<T>> {
    try {
      if (method !== 'GET') await options.ensureToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (init.json) headers['Content-Type'] = 'application/json';
      const response = await fetch(withQuery(address(path), init.query), {
        method,
        credentials: 'include',
        headers: method === 'GET' ? headers : options.headers(headers),
        body: init.body,
      });
      return await settle<T>(response);
    } catch {
      return { ok: false, status: 0, code: 'NETWORK', message: NETWORK_MESSAGE };
    }
  }

  const write =
    (method: string) =>
    <T>(path: string, body?: unknown) =>
      send<T>(method, path, body === undefined ? {} : { body: JSON.stringify(body), json: true });

  return {
    get: (path, query) => send('GET', path, { query }),
    post: write('POST'),
    put: write('PUT'),
    patch: write('PATCH'),
    delete: write('DELETE'),
    upload: (path, form) => send('POST', path, { body: form }),
    url: (path, query) => withQuery(address(path), query),
  };
}

/** The first field error, for a form that shows one line under each field. */
export function fieldError(result: ApiResult<unknown> | null | undefined, field: string): string | undefined {
  if (!result || result.ok) return undefined;
  return result.errors?.[field]?.[0];
}

/**
 * A load a page skips for now (nothing chosen yet, no permission): an
 * answer with nothing in it. A resource's data is already `T | undefined`,
 * so the empty answer types as `never` and leaves `T` to the real load.
 */
export function skipped(): Promise<ApiResult<never>> {
  return Promise.resolve({ ok: true, status: 204, message: '', data: undefined as never });
}
