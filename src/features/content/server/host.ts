import type { AccessRule } from '../../../shared/security/access';
import type { ReportedActivity } from '../../../shared/security/activity';
import type { CONTENT_ACTIVITY, ContentAccess, EntryFile, EntryImage } from '../contract';

/**
 * What the application supplies to Content: who is asking and what they may
 * do, and the library's photos and documents that entries point at. Content
 * stores only media ids; the host says which still exist and how to draw them.
 */
export interface ContentServerHost {
  readonly sessionCookieName: string;
  resolveActor(sessionToken: string | undefined): { id: string } | undefined;
  readonly access: ContentAccess;
  allows(actorId: string, rule: AccessRule): boolean;
  images(ids: readonly string[]): Map<string, EntryImage>;
  files(ids: readonly string[]): Map<string, EntryFile>;
  report(activity: ReportedActivity<'content', typeof CONTENT_ACTIVITY>): void;
}
