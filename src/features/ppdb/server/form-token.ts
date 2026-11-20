import { createHmac, timingSafeEqual } from 'node:crypto';
import { FORM_TOKEN_MAX_AGE_MS, MIN_FILL_MS } from '../contract';

/**
 * The time a visitor opened the form, signed so it cannot be made up. A
 * registration sent within seconds of opening the form, or with no opened
 * form at all, comes from a script; one opened half a day ago is stale.
 */
function sign(key: string, issuedAt: number): string {
  return createHmac('sha256', key).update(`ppdb-form:${issuedAt}`).digest('base64url');
}

export function issueFormToken(key: string, now: number): string {
  return `${now.toString(36)}.${sign(key, now)}`;
}

export type TokenCheck = 'ok' | 'invalid' | 'too-fast' | 'expired';

export function checkFormToken(key: string, token: string, now: number): TokenCheck {
  const [stamp, signature] = token.split('.');
  if (!stamp || !signature || !/^[0-9a-z]{1,12}$/.test(stamp)) return 'invalid';
  const issuedAt = Number.parseInt(stamp, 36);
  const expected = Buffer.from(sign(key, issuedAt));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'invalid';
  if (now - issuedAt < MIN_FILL_MS) return 'too-fast';
  if (now - issuedAt > FORM_TOKEN_MAX_AGE_MS) return 'expired';
  return 'ok';
}
