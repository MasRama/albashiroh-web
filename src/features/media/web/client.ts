import { inject, provide, type InjectionKey } from 'vue';
import { createApi, type ApiOptions, type ApiResult } from '../../../shared/ui';
import { IMAGE_VARIANTS, MEDIA_PUBLIC_PATH, type ImageVariant, type MediaItem, type MediaKind, type MediaPage } from '../contract';

export interface MediaClient {
  list(query: { page?: number; limit?: number; kind?: MediaKind; q?: string }): Promise<ApiResult<MediaPage>>;
  upload(file: File, alt?: string): Promise<ApiResult<{ item: MediaItem }>>;
  update(id: string, input: { name: string; alt: string; revision: number }): Promise<ApiResult<{ item: MediaItem }>>;
  remove(id: string): Promise<ApiResult<{ id: string }>>;
}

/** The library's client, built with the session's CSRF helpers by the application. */
export function createMediaClient(options: ApiOptions, base = '/api/media'): MediaClient {
  const api = createApi(options, base);
  const at = (id: string) => `/${encodeURIComponent(id)}`;
  return {
    list: (query) => api.get('/', query),
    upload: (file, alt = '') => {
      const form = new FormData();
      form.append('file', file);
      if (alt) form.append('alt', alt);
      return api.upload('/', form);
    },
    update: (id, input) => api.patch(at(id), input),
    remove: (id) => api.delete(at(id)),
  };
}

const MEDIA_CLIENT: InjectionKey<MediaClient> = Symbol('media-client');

/** Makes the library available to every media field and picker below this component. */
export function provideMediaClient(client: MediaClient): void {
  provide(MEDIA_CLIENT, client);
}

export function useMediaClient(): MediaClient {
  const client = inject(MEDIA_CLIENT, null);
  if (!client) throw new Error('Media fields need provideMediaClient() in an ancestor');
  return client;
}

/** A stored photo's address at one width; ids are enough, so a form can show what it holds without a lookup. */
export function imageUrl(id: string, variant: ImageVariant = 'md'): string {
  return `${MEDIA_PUBLIC_PATH}/${encodeURIComponent(id)}/${variant}.webp`;
}

/** `srcset` across every stored width. */
export function imageSrcset(id: string): string {
  return (Object.entries(IMAGE_VARIANTS) as [ImageVariant, number][]).map(([variant, width]) => `${imageUrl(id, variant)} ${width}w`).join(', ');
}

/** Accept lists for the file inputs, matching what the server takes. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/jpeg,image/png,image/webp';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Indonesian text for each refusal the library can answer with. */
export function mediaRefusalText(result: { code: string; message: string }): string {
  switch (result.code) {
    case 'FILE_TOO_LARGE':
      return 'Berkas terlalu besar. Foto paling besar 15 MB, dokumen 25 MB.';
    case 'INVALID_FILE_TYPE':
      return 'Jenis berkas tidak didukung. Gunakan foto JPG, PNG atau WebP, atau dokumen PDF, Word, Excel atau PowerPoint.';
    case 'UPLOAD_FAILED':
      return 'Berkas tidak bisa diproses. Coba simpan ulang fotonya lalu unggah lagi.';
    case 'FILE_REQUIRED':
      return 'Pilih berkas yang akan diunggah.';
    case 'MEDIA_NOT_FOUND':
      return 'Berkas ini sudah dihapus.';
    case 'FORBIDDEN':
      return 'Anda tidak punya izin untuk tindakan ini.';
    case 'PAYLOAD_TOO_LARGE':
      return 'Berkas terlalu besar untuk diunggah.';
    case 'NETWORK':
      return result.message;
    default:
      return result.message;
  }
}
