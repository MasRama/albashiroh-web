import { csrfHeaders, ensureCsrfToken } from '../features/auth/web';
import { createContentClient } from '../features/content/web';
import { createMediaClient } from '../features/media/web';

/**
 * Clients for the content screens, built with the session's CSRF helpers.
 * The admin shell provides the media client to every photo and document
 * field below it.
 */
const options = { ensureToken: ensureCsrfToken, headers: csrfHeaders };

export const mediaClient = createMediaClient(options);
export const contentClient = createContentClient(options);
