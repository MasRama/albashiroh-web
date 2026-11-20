import type { Hono } from 'hono';
import { declarePermissions, declareRoles, getCurrentUser, isAllowed, SESSION_COOKIE_NAME } from '../../features/auth';
import {
  CONTENT_ACTIVITY,
  CONTENT_PERMISSIONS,
  contentAccess,
  createContentRoutes,
  createSiteRoutes,
  type ContentServerHost,
} from '../../features/content';
import { fileRefs, imageRefs } from '../../features/media';
import type { ActivityReporter } from '../../shared/security';

// Auth owns the permission rows; it writes content.<portal> at startup.
declarePermissions('content', CONTENT_PERMISSIONS);

/**
 * The school's editor roles, created at first start. Each edits one portal
 * and may add photos and documents to the library; deleting from the library
 * stays with administrators, since a photo can be used on every portal.
 */
declareRoles([
  { slug: 'editor-yayasan', name: 'Editor Yayasan', description: 'Isi situs Yayasan: profil, berita, galeri, dokumen', permissions: ['content.yayasan', 'media.view', 'media.upload'] },
  { slug: 'editor-smp', name: 'Editor SMP', description: 'Isi portal SMP IT Al Bashiroh', permissions: ['content.smp', 'media.view', 'media.upload'] },
  { slug: 'editor-sma', name: 'Editor SMA', description: 'Isi portal SMA IT Al Bashiroh', permissions: ['content.sma', 'media.view', 'media.upload'] },
]);

export function createContentServerHost(activity: ActivityReporter): ContentServerHost {
  return {
    sessionCookieName: SESSION_COOKIE_NAME,
    resolveActor: (sessionToken) => {
      const user = getCurrentUser(sessionToken);
      return user ? { id: user.id } : undefined;
    },
    access: contentAccess('content'),
    allows: (actorId, rule) => isAllowed(actorId, rule),
    images: imageRefs,
    files: fileRefs,
    report: activity.declare('content', CONTENT_ACTIVITY),
  };
}

export default function composeContentServer(app: Hono, options: { activity: ActivityReporter }): void {
  const host = createContentServerHost(options.activity);
  app.route('/api/content', createContentRoutes(host));
  app.route('/api/site', createSiteRoutes(host));
}
