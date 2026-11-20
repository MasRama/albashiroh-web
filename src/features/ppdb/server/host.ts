import type { MiddlewareHandler } from 'hono';
import type { AccessRule } from '../../../shared/security/access';
import type { ReportedActivity } from '../../../shared/security/activity';
import type { PPDB_ACTIVITY, PpdbAccess } from '../contract';

/**
 * What the application supplies to PPDB: who is asking and what they may do,
 * the limit on how often one visitor may register, and the clock.
 */
export interface PpdbServerHost {
  readonly sessionCookieName: string;
  resolveActor(sessionToken: string | undefined): { id: string } | undefined;
  readonly access: PpdbAccess;
  allows(actorId: string, rule: AccessRule): boolean;
  /** Runs before a registration is read: the per-visitor limit. */
  readonly submitLimit?: MiddlewareHandler;
  report(activity: ReportedActivity<'ppdb', typeof PPDB_ACTIVITY>): void;
  now?(): number;
}
