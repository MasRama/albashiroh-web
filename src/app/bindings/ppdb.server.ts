import type { Hono } from 'hono';
import { every } from 'hono/combine';
import { z } from 'zod';
import { declarePermissions, declareRoles, getCurrentUser, isAllowed, SESSION_COOKIE_NAME } from '../../features/auth';
import { createPpdbRoutes, PPDB_ACTIVITY, PPDB_PERMISSIONS, PPDB_ROUTE_POLICIES, ppdbAccess, type PpdbServerHost } from '../../features/ppdb';
import { readFeatureEnv } from '../../shared/config';
import { createRateLimiter, declareRoutePolicies, type ActivityReporter } from '../../shared/security';

// Auth owns the permission rows; it writes ppdb.view and ppdb.manage at startup.
declarePermissions('ppdb', PPDB_PERMISSIONS);

/** The PPDB committee: reads and downloads the registrations, sets their status, and opens or closes the form. */
declareRoles([
  { slug: 'panitia-ppdb', name: 'Panitia PPDB', description: 'Data pendaftar PPDB SMP dan SMA: lihat, unduh, ubah status', permissions: ['ppdb.view', 'ppdb.manage'] },
]);

const environment = readFeatureEnv('ppdb', {
  /**
   * Registrations accepted from one address per hour. Families on one network
   * (the school's wifi on registration day, a phone carrier's shared address)
   * share it, so it is generous; refused and repeated sends do not count.
   */
  PPDB_SUBMIT_MAX: z.coerce.number().int().positive().default(30),
  /** Sends of any outcome from one address per hour: holds off a script hammering the form. */
  PPDB_ATTEMPT_MAX: z.coerce.number().int().positive().default(120),
});

const HOUR = 60 * 60 * 1000;
const attemptLimiter = createRateLimiter({ name: 'ppdb-attempt', maxRequests: environment.PPDB_ATTEMPT_MAX, windowMs: HOUR });
const submitLimiter = createRateLimiter({
  name: 'ppdb-submit',
  maxRequests: environment.PPDB_SUBMIT_MAX,
  windowMs: HOUR,
  counts: (context) => context.res.status === 201,
});

/** Deterministic test reset for the per-visitor registration limits. */
export function resetPpdbSubmitLimit(): void {
  attemptLimiter.reset();
  submitLimiter.reset();
}

export function createPpdbServerHost(activity: ActivityReporter): PpdbServerHost {
  return {
    sessionCookieName: SESSION_COOKIE_NAME,
    resolveActor: (sessionToken) => {
      const user = getCurrentUser(sessionToken);
      return user ? { id: user.id } : undefined;
    },
    access: ppdbAccess('ppdb'),
    allows: (actorId, rule) => isAllowed(actorId, rule),
    submitLimit: every(attemptLimiter.middleware, submitLimiter.middleware),
    report: activity.declare('ppdb', PPDB_ACTIVITY),
  };
}

export default function composePpdbServer(app: Hono, options: { activity: ActivityReporter }): void {
  declareRoutePolicies(app, '/api/ppdb', PPDB_ROUTE_POLICIES);
  app.route('/api/ppdb', createPpdbRoutes(createPpdbServerHost(options.activity)));
}
