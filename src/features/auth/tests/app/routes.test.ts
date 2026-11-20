import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../../app/server';
import { csrfHeaders, issueCsrf, mergeResponseCookies } from '../../../../shared/security/tests/helpers';
import { createTestAccount, TEST_PASSWORD } from '../../../../app/tests/personas';

function sessionId(cookieJar: string): string {
  const match = cookieJar
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('auth_id='));
  if (!match) throw new Error('Session cookie missing from jar');
  return match;
}

describe('auth feature', () => {
  it('signs in, authenticates, and ends a session end-to-end', async () => {
    const email = `${randomUUID()}@example.com`;
    await createTestAccount('Ada Lovelace', email);
    const bootstrap = await issueCsrf(app);
    const json = { 'Content-Type': 'application/json' };

    const loginResponse = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { ...csrfHeaders(bootstrap), ...json },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });

    expect(loginResponse.status).toBe(200);
    const sessionCookie = mergeResponseCookies(bootstrap.cookie, loginResponse);
    expect(sessionId(sessionCookie)).toMatch(/^auth_id=.+/);

    const meResponse = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie },
    });
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      success: true,
      data: { user: { email, name: 'Ada Lovelace' } },
    });

    const logoutState = await issueCsrf(app, sessionCookie);
    const logoutResponse = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: csrfHeaders(logoutState),
    });
    expect(logoutResponse.status).toBe(200);

    const afterLogoutResponse = await app.request('/api/auth/me', {
      headers: { Cookie: sessionCookie },
    });
    expect(afterLogoutResponse.status).toBe(401);
  });

  it('answers registration like an absent route: the owner creates accounts', async () => {
    const bootstrap = await issueCsrf(app);
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { ...csrfHeaders(bootstrap), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Visitor', email: `${randomUUID()}@example.com`, password: TEST_PASSWORD }),
    });
    expect(response.status).toBe(404);
  });
});
