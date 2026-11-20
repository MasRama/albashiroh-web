import { Hono } from 'hono';
import { csrfProtection } from '../../../../shared/security';
import { createAccessRoutes } from '../../server/access-routes';
import { passwordChangeGate } from '../../server/password-change-gate';
import { createAuthRoutes } from '../../server/routes';

/**
 * Auth as it ships, registration open, behind the CSRF check and
 * password-change gate the application mounts. The application closes
 * registration (an administrator creates accounts); these tests keep Auth's own
 * registration behaviour covered.
 */
export function createReferenceAuthApp(): Hono {
  const reference = new Hono();
  reference.use('*', csrfProtection({ isProduction: false }));
  reference.use('/api/*', passwordChangeGate('/api/auth'));
  reference.route('/api/auth', createAuthRoutes());
  reference.route('/api/roles', createAccessRoutes());
  return reference;
}
