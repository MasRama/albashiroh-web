export {
  ADMIN_ROLE_SLUG,
  AUTH_ACCOUNT_CHANGED_EVENT,
  AUTH_ROLES_CHANGED_EVENT,
  AUTH_SESSIONS_CHANGED_EVENT,
  changePasswordInputSchema,
  rolesAccess,
} from '../contract';
export type { ChangePasswordInput } from '../contract';
export { createAuthClient, type AuthClient } from './client';
export { createAuthSession, SESSION_ENDED_REASON, useAuthSession } from './session';
export {
  CSRF_BOOTSTRAP_PATH,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfHeaders,
  ensureCsrfToken,
  readCsrfToken,
} from './csrf';
export { createAccessClient, type AccessClient } from './access-client';
// Application-owned security pages draw the enrollment QR code with the same encoder.
export { encodeQr, qrSvgPath } from './qr';
export type {
  CurrentUser,
  PermissionData,
  PermissionsResponse,
  RoleData,
  RoleResponse,
  RolesResponse,
} from '../contract';
export { default as LoginPage } from './pages/LoginPage.vue';
export { default as RegisterPage } from './pages/RegisterPage.vue';
export { default as RolesPage } from './pages/RolesPage.vue';
export { default as ChangePasswordPage } from './pages/ChangePasswordPage.vue';
export { default as SecurityPage } from './pages/SecurityPage.vue';
