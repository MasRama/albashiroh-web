import { randomUUID } from 'node:crypto';
import {
  createAccountWithRoles,
  createRoleWithPermissions,
  findAllPermissions,
  findAllRoles,
  getUserRoles,
  getUsersWithRole,
  hashPassword,
  resetAccountPassword,
  syncUserRoles,
} from '../../features/auth';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../shared/security/tests/helpers';
import { app } from '../server';

/**
 * Test accounts for the composed application. Accounts, roles, and grants are
 * Auth's tables, so tests outside Auth make people through these helpers,
 * which create accounts and grant through Auth's public
 * boundary, instead of writing those tables themselves.
 */
export const TEST_PASSWORD = 'correct horse battery staple';

export interface Persona {
  id: string;
  name: string;
  email: string;
  /** Session and CSRF cookies, as a request `Cookie` header value. */
  cookie: string;
}

/**
 * Creates an account the way an administrator does from Users, through
 * Auth's boundary: this application closes self-registration. Returns its id.
 */
export async function createTestAccount(
  name = 'Test Account',
  email = `${randomUUID()}@example.com`,
  password = TEST_PASSWORD,
): Promise<string> {
  return createAccountWithRoles({ id: randomUUID(), name, email, passwordHash: await hashPassword(password) }).id;
}

/** Creates an account and signs it in through Auth's own login endpoint. */
export async function signUp(name = 'Test Account', email = `${randomUUID()}@example.com`): Promise<Persona> {
  const id = await createTestAccount(name, email);
  const cookie = await signIn(email, TEST_PASSWORD);
  if (!cookie.includes('auth_id=')) throw new Error('Sign-in did not return a session cookie');
  return { id, name, email, cookie };
}

/**
 * Gives the account the role, creating it with these declared permissions
 * when no role has the slug yet; an existing role is used as it is. The
 * account keeps its other roles.
 */
export function grantRole(userId: string, roleSlug: string, permissionSlugs: readonly string[] = []): void {
  let role = findAllRoles().find((candidate) => candidate.slug === roleSlug);
  if (!role) {
    const permissions = findAllPermissions();
    const permissionIds = permissionSlugs.map((slug) => {
      const permission = permissions.find((candidate) => candidate.slug === slug);
      if (!permission) throw new Error(`No Feature declares the permission "${slug}"`);
      return permission.id;
    });
    role = createRoleWithPermissions({ id: randomUUID(), name: roleSlug, slug: roleSlug, description: null }, permissionIds);
  }
  const current = getUserRoles(userId).map((held) => held.id);
  if (!current.includes(role.id)) syncUserRoles(userId, [...current, role.id]);
}

/** Takes the role away from every account holding it, so a test can start without, say, any administrator. */
export function revokeRoleFromEveryone(roleSlug: string): void {
  const role = findAllRoles().find((candidate) => candidate.slug === roleSlug);
  if (!role) return;
  for (const holder of getUsersWithRole(role.id)) {
    syncUserRoles(holder.id, getUserRoles(holder.id).map((held) => held.id).filter((id) => id !== role.id));
  }
}

/** Holds every permission, as the `admin` role does. */
export function grantAdmin(userId: string): void {
  grantRole(userId, 'admin');
}

/** Gives the account the permissions through a role of its own. */
export function grantPermissions(userId: string, permissionSlugs: readonly string[]): void {
  grantRole(userId, `test-${randomUUID()}`, permissionSlugs);
}

/**
 * Resets the account to a temporary password the way an administrator does,
 * which signs it out everywhere, then signs in again; the returned cookie
 * belongs to a session that must replace the password before using the API.
 */
export async function requirePasswordChange(persona: Persona): Promise<Persona> {
  resetAccountPassword(persona.id, await hashPassword(TEST_PASSWORD));
  return { ...persona, cookie: await signIn(persona.email, TEST_PASSWORD) };
}

/** Signs in through Auth's own endpoint and returns the session and CSRF cookies. */
export async function signIn(email: string, password: string): Promise<string> {
  const bootstrap = await issueCsrf(app);
  const response = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { ...csrfHeaders(bootstrap), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (response.status !== 200) throw new Error(`Sign-in failed with ${response.status}`);
  return mergeResponseCookies(bootstrap.cookie, response);
}
