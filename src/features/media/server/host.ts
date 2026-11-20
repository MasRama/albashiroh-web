import type { AccessRule } from '../../../shared/security/access';
import type { ReportedActivity } from '../../../shared/security/activity';
import type { AssetStorage } from '../../../shared/storage';
import type { MEDIA_ACTIVITY, MediaAccess } from '../contract';

/** What the application supplies to Media: who is asking, what they may do, where bytes live. */
export interface MediaServerHost {
  readonly sessionCookieName: string;
  resolveActor(sessionToken: string | undefined): { id: string } | undefined;
  readonly access: MediaAccess;
  allows(actorId: string, rule: AccessRule): boolean;
  readonly storage: AssetStorage;
  report(activity: ReportedActivity<'media', typeof MEDIA_ACTIVITY>): void;
}
