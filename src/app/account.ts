import { csrfHeaders, ensureCsrfToken } from '../features/auth/web';
import { createApi } from '../shared/ui';

/**
 * The admin's account screens (sign-in, password, profile, users, roles,
 * security, activity) talk to the routes Auth, Users and Activity mount,
 * through the app's own JSON client so they read like every other admin
 * screen. The shapes below are the ones those routes answer with.
 */
const options = { ensureToken: ensureCsrfToken, headers: csrfHeaders };
const auth = createApi(options, '/api/auth');
const users = createApi(options, '/api/users');
const roles = createApi(options, '/api/roles');
const activity = createApi(options, '/api/activity');
const at = (id: string) => `/${encodeURIComponent(id)}`;

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  revision: number;
}

export interface ManagedUser extends Profile {
  /** Role slugs. */
  roles: string[];
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
  userCount: number;
  revision: number;
}

export interface Permission {
  id: string;
  name: string;
  slug: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface DeviceSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: number;
  lastSeenAt: number | null;
  current: boolean;
}

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: number | null;
  recoveryCodesRemaining: number;
}

export interface ActivityRecord {
  id: string;
  action: string;
  resource: string;
  actorId: string | null;
  targetId: string | null;
  targetLabel: string | null;
  metadata: Record<string, string | number | boolean | null>;
  occurredAt: number;
}

export interface DeclaredAction {
  action: string;
  label: string;
  kind: string;
}

export const accountClient = {
  login: (email: string, password: string) => auth.post<{ twoFactorRequired: boolean }>('/login', { email, password }),
  completeTwoFactor: (input: { code: string } | { recovery_code: string }) => auth.post<unknown>('/two-factor/challenge', input),
  changePassword: (currentPassword: string, newPassword: string) =>
    auth.post<unknown>('/change-password', { current_password: currentPassword, new_password: newPassword }),

  sessions: () => auth.get<{ sessions: DeviceSession[] }>('/sessions'),
  revokeSession: (id: string) => auth.delete<{ revoked: number }>(`/sessions${at(id)}`),
  revokeOtherSessions: () => auth.post<{ revoked: number }>('/sessions/revoke-others'),
  twoFactor: () => auth.get<{ twoFactor: TwoFactorStatus }>('/two-factor'),
  startTwoFactor: (password: string) => auth.post<{ secret: string; otpauthUrl: string }>('/two-factor/setup', { password }),
  enableTwoFactor: (code: string) => auth.post<{ recoveryCodes: string[] }>('/two-factor/enable', { code }),
  disableTwoFactor: (password: string) => auth.post<unknown>('/two-factor/disable', { password }),
  newRecoveryCodes: (password: string) => auth.post<{ recoveryCodes: string[] }>('/two-factor/recovery-codes', { password }),

  profile: () => users.get<{ user: Profile }>('/me'),
  saveProfile: (input: { revision: number; name: string; email: string }) => users.patch<{ user: Profile }>('/me', input),
  users: (query: { page?: number; limit?: number; search?: string } = {}) =>
    users.get<{ users: ManagedUser[]; total: number; page: number; limit: number }>('', query),
  createUser: (input: { name: string; email: string; password: string; roles: string[] }) => users.post<{ user: ManagedUser }>('', input),
  saveUser: (id: string, input: { revision: number; name: string; email: string; roles?: string[] }) => users.put<{ user: ManagedUser }>(at(id), input),
  resetPassword: (id: string, password: string) => users.post<{ user: ManagedUser }>(`${at(id)}/reset-password`, { password }),
  deleteUser: (id: string) => users.delete<{ deleted: number }>('', { ids: [id] }),

  roles: () => roles.get<{ roles: Role[] }>(''),
  permissions: () => roles.get<Record<string, Permission[]>>('/permissions'),
  createRole: (input: { name: string; slug: string; description: string | null; permissions: string[] }) => roles.post<{ role: Role }>('', input),
  saveRole: (id: string, input: { revision: number; name: string; description: string | null; permissions: string[] }) =>
    roles.put<{ role: Role }>(at(id), input),
  deleteRole: (id: string) => roles.delete<{ deleted: number }>('', { ids: [id] }),

  activity: (query: { page?: number; limit?: number; action?: string } = {}) =>
    activity.get<{ activities: ActivityRecord[]; total: number; page: number; limit: number; actions: DeclaredAction[] }>('', query),
};

/**
 * A save refused as STALE_REVISION: keep the fields this person changed from
 * what they opened, and take every other field from the version saved since.
 */
export function mergeStale<T extends object>(opened: T, draft: T, saved: T): T {
  const merged = { ...saved };
  for (const key of Object.keys(draft) as (keyof T)[]) {
    if (JSON.stringify(draft[key]) !== JSON.stringify(opened[key])) merged[key] = draft[key];
  }
  return merged;
}

/** Where a signed-in person lands: the `redirect` they were sent from, if it is a path on this site. */
export function redirectTarget(redirect: unknown): string {
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/\\') ? redirect : '/admin';
}

/** What the account routes refuse with, in the admin's words; anything else shows the server's message. */
const REFUSAL: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email atau kata sandi salah.',
  LOGIN_LOCKED: 'Terlalu banyak percobaan masuk. Tunggu beberapa menit, lalu coba lagi.',
  RATE_LIMITED: 'Terlalu banyak permintaan. Tunggu sebentar, lalu coba lagi.',
  INVALID_TWO_FACTOR_CODE: 'Kodenya salah. Coba lagi.',
  TWO_FACTOR_CHALLENGE_EXPIRED: 'Waktu verifikasi habis. Silakan masuk lagi dari awal.',
  TWO_FACTOR_LOCKED: 'Terlalu banyak kode salah. Silakan masuk lagi dari awal.',
  INVALID_PASSWORD: 'Kata sandi salah.',
  DUPLICATE_EMAIL: 'Email ini sudah dipakai akun lain.',
  DUPLICATE_SLUG: 'Sudah ada peran dengan nama ini.',
  LAST_ADMIN: 'Harus tetap ada minimal satu administrator.',
  PROTECTED_ADMIN: 'Hanya administrator yang bisa mengubah akun administrator.',
  PROTECTED_ROLE: 'Peran administrator tidak bisa diubah atau dihapus.',
  SELF_DELETE: 'Anda tidak bisa menghapus akun Anda sendiri.',
  SELF_DEMOTION: 'Anda tidak bisa mencabut peran administrator dari akun Anda sendiri.',
  CURRENT_SESSION: 'Ini perangkat yang sedang Anda pakai. Gunakan tombol Keluar.',
  FORBIDDEN: 'Akun Anda tidak punya izin untuk ini.',
  VALIDATION_ERROR: 'Periksa lagi isian yang ditandai.',
  NETWORK: 'Tidak bisa terhubung ke server. Periksa koneksi, lalu coba lagi.',
};
export const refusalText = (result: { code: string; message: string }) => REFUSAL[result.code] ?? result.message;

/** Role names as the school says them; roles made in Peran & izin keep the name they were given. */
export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  'editor-yayasan': 'Editor Yayasan',
  'editor-smp': 'Editor SMP',
  'editor-sma': 'Editor SMA',
  'panitia-ppdb': 'Panitia PPDB',
  user: 'Staf',
};
export const roleLabel = (role: Pick<Role, 'slug' | 'name'>) => ROLE_LABEL[role.slug] ?? role.name;
const ROLE_NOTE: Record<string, string> = {
  admin: 'Semua izin, termasuk pengguna dan peran',
  'editor-yayasan': 'Isi situs Yayasan: profil, berita, galeri, dokumen',
  'editor-smp': 'Isi portal SMP IT Al Bashiroh',
  'editor-sma': 'Isi portal SMA IT Al Bashiroh',
  'panitia-ppdb': 'Data pendaftar PPDB dan ekspornya',
  user: 'Bisa masuk dan mengurus akunnya sendiri',
};
const ROLE_ORDER = ['admin', 'editor-yayasan', 'editor-smp', 'editor-sma', 'panitia-ppdb', 'user'];
/** Administrator first, then the school's roles in a fixed order, then the rest by name. */
export const sortRoles = <T extends Pick<Role, 'slug' | 'name'>>(roles: readonly T[]): T[] => {
  const rank = (role: T) => ROLE_ORDER.indexOf(role.slug) >>> 0;
  return [...roles].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'id'));
};
export const roleNote = (role: Pick<Role, 'slug' | 'description'>) => ROLE_NOTE[role.slug] ?? role.description ?? undefined;
