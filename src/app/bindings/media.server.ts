import type { Hono } from 'hono';
import { resolve } from 'node:path';
import { declarePermissions, getCurrentUser, isAllowed, SESSION_COOKIE_NAME } from '../../features/auth';
import {
  createMediaFileRoutes,
  createMediaRoutes,
  MEDIA_ACTIVITY,
  MEDIA_PERMISSIONS,
  MEDIA_PUBLIC_PATH,
  MEDIA_ROUTE_POLICIES,
  mediaAccess,
  type MediaServerHost,
} from '../../features/media';
import { declareRoutePolicies, type ActivityReporter } from '../../shared/security';
import { createLocalAssetStorage, type AssetStorage } from '../../shared/storage';

// Auth owns the permission rows; it writes media.<action> at startup.
declarePermissions('media', MEDIA_PERMISSIONS);

/** Uploaded photos and documents live next to the avatars, under storage/media. */
export const mediaStorage = createLocalAssetStorage({ root: resolve(process.cwd(), 'storage') });

export function createMediaServerHost(activity: ActivityReporter, storage: AssetStorage = mediaStorage): MediaServerHost {
  return {
    sessionCookieName: SESSION_COOKIE_NAME,
    resolveActor: (sessionToken) => {
      const user = getCurrentUser(sessionToken);
      return user ? { id: user.id } : undefined;
    },
    access: mediaAccess('media'),
    allows: (actorId, rule) => isAllowed(actorId, rule),
    storage,
    report: activity.declare('media', MEDIA_ACTIVITY),
  };
}

export default function composeMediaServer(app: Hono, options: { activity: ActivityReporter }): void {
  const host = createMediaServerHost(options.activity);
  declareRoutePolicies(app, '/api/media', MEDIA_ROUTE_POLICIES);
  app.route('/api/media', createMediaRoutes(host));
  app.route(MEDIA_PUBLIC_PATH, createMediaFileRoutes(host));
}
