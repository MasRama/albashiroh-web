import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  AGGREGATED_TYPES,
  contentType,
  entryInputSchema,
  entryQuerySchema,
  entryUpdateSchema,
  PORTAL_INFO,
  PORTALS,
  portalSettingsUpdateSchema,
  publicListQuerySchema,
  reorderSchema,
  type ContentType,
  type EntryPage,
  type Portal,
  type PublicEntryPage,
} from '../contract';
import { createGuard, jsonInput, publicRoute, queryInput, type Guard } from '../../../shared/security';
import type { ContentServerHost } from './host';
import {
  presentEntries,
  presentEntry,
  presentPublic,
  presentPublicDetail,
  presentSettings,
  portalSummary,
  takesImage,
  withoutImage,
} from './present';
import {
  deleteEntry,
  entryImageIds,
  findEntryRow,
  findPublishedRow,
  insertEntry,
  listEntryRows,
  listPublishedRows,
  readSettings,
  reorderEntries,
  saveSettings,
  updateEntry,
} from './repository';
import { entryValues, settingsValues } from './values';

function refuse<C extends string>(context: Context, status: 404 | 409, message: string, code: C, extra: object = {}) {
  return context.json({ success: false as const, message, code, ...extra }, status);
}

function invalid(context: Context, errors: Record<string, string[]>) {
  return context.json({ success: false as const, message: 'Validation failed', code: 'VALIDATION_ERROR' as const, errors }, 422);
}

/** The type named in the path, when the portal carries it. */
function typeIn(portal: Portal, name: string): ContentType | undefined {
  const def = contentType(name);
  return def && def.portals.includes(portal) ? (name as ContentType) : undefined;
}

const noType = (context: Context) => refuse(context, 404, 'This portal has no such content type', 'TYPE_NOT_FOUND');
const noEntry = (context: Context) => refuse(context, 404, 'Entry not found', 'ENTRY_NOT_FOUND');

function portalRoutes(host: ContentServerHost, guard: Guard<{ id: string }>, portal: Portal) {
  const allowed = guard.allow(host.access[portal]);
  const label = (title: string) => `${PORTAL_INFO[portal].short} · ${title}`;

  return new Hono()
    .get('/summary', allowed, (context) =>
      context.json({ success: true as const, message: 'OK', data: { portal, types: portalSummary(portal, host) } }),
    )
    .get('/settings', allowed, (context) =>
      context.json({ success: true as const, message: 'OK', data: { record: presentSettings(portal, readSettings(portal), host) } }),
    )
    .put('/settings', allowed, jsonInput(portalSettingsUpdateSchema), (context) => {
      const actor = guard.actor(context);
      const input = context.req.valid('json');
      const checked = settingsValues(portal, input.settings, host);
      if (!checked.ok) return invalid(context, checked.errors);
      const result = saveSettings(portal, checked.values, input.revision, actor.id);
      const record = presentSettings(portal, result.stored, host);
      if (result.status === 'stale') {
        return refuse(context, 409, 'Someone else changed these settings since you opened them', 'STALE_REVISION', { current: record });
      }
      host.report({ action: 'content.configured', resource: 'content', actorId: actor.id, targetId: portal, targetLabel: label('Pengaturan'), metadata: { portal } });
      return context.json({ success: true as const, message: 'Saved', data: { record } });
    })
    .get('/:type', allowed, queryInput(entryQuerySchema), (context) => {
      const type = typeIn(portal, context.req.param('type'));
      if (!type) return noType(context);
      const query = context.req.valid('query');
      const filter = { q: query.q, status: query.status };
      let ids: string[] | undefined;
      if (query.missingImage) {
        ids = takesImage(type) ? [...withoutImage(entryImageIds(portal, type, filter), host)] : [];
      }
      const { rows, total } = listEntryRows(portal, type, { ...query, ...filter, ids });
      return context.json({
        success: true as const,
        message: 'OK',
        data: { items: presentEntries(rows, host), total, page: query.page, limit: query.limit } satisfies EntryPage,
      });
    })
    .post('/:type', allowed, jsonInput(entryInputSchema), (context) => {
      const type = typeIn(portal, context.req.param('type'));
      if (!type) return noType(context);
      const actor = guard.actor(context);
      const checked = entryValues(portal, type, context.req.valid('json'), host);
      if (!checked.ok) return invalid(context, checked.errors);
      const row = insertEntry(portal, type, checked.values, actor.id);
      host.report({ action: 'content.created', resource: 'content', actorId: actor.id, targetId: row.id, targetLabel: label(row.title), metadata: { portal, type } });
      return context.json({ success: true as const, message: 'Created', data: { entry: presentEntry(row, host) } }, 201);
    })
    .put('/:type/order', allowed, jsonInput(reorderSchema), (context) => {
      const type = typeIn(portal, context.req.param('type'));
      if (!type) return noType(context);
      const actor = guard.actor(context);
      const moved = reorderEntries(portal, type, context.req.valid('json').ids);
      host.report({ action: 'content.reordered', resource: 'content', actorId: actor.id, targetId: null, targetLabel: label(type), metadata: { portal, type, moved } });
      return context.json({ success: true as const, message: 'Saved', data: { moved } });
    })
    .get('/:type/:id', allowed, (context) => {
      const type = typeIn(portal, context.req.param('type'));
      if (!type) return noType(context);
      const row = findEntryRow(portal, type, context.req.param('id'));
      if (!row) return noEntry(context);
      return context.json({ success: true as const, message: 'OK', data: { entry: presentEntry(row, host) } });
    })
    .patch('/:type/:id', allowed, jsonInput(entryUpdateSchema), (context) => {
      const type = typeIn(portal, context.req.param('type'));
      if (!type) return noType(context);
      const actor = guard.actor(context);
      const id = context.req.param('id');
      const input = context.req.valid('json');
      const existing = findEntryRow(portal, type, id);
      if (!existing) return noEntry(context);
      if (existing.revision !== input.revision) {
        return refuse(context, 409, 'Someone else changed this entry since you opened it', 'STALE_REVISION', { current: presentEntry(existing, host) });
      }
      const checked = entryValues(portal, type, input, host, id);
      if (!checked.ok) return invalid(context, checked.errors);
      const result = updateEntry(portal, type, id, checked.values, input.revision);
      if (result.status === 'missing') return noEntry(context);
      if (result.status === 'stale') {
        return refuse(context, 409, 'Someone else changed this entry since you opened it', 'STALE_REVISION', { current: presentEntry(result.row, host) });
      }
      host.report({ action: 'content.updated', resource: 'content', actorId: actor.id, targetId: id, targetLabel: label(result.row.title), metadata: { portal, type } });
      return context.json({ success: true as const, message: 'Saved', data: { entry: presentEntry(result.row, host) } });
    })
    .delete('/:type/:id', allowed, (context) => {
      const type = typeIn(portal, context.req.param('type'));
      if (!type) return noType(context);
      const actor = guard.actor(context);
      const removed = deleteEntry(portal, type, context.req.param('id'));
      if (!removed) return noEntry(context);
      host.report({ action: 'content.deleted', resource: 'content', actorId: actor.id, targetId: removed.id, targetLabel: label(removed.title), metadata: { portal, type } });
      return context.json({ success: true as const, message: 'Deleted', data: { id: removed.id } });
    });
}

/**
 * The admin's content API, one sub-application per portal so every route
 * records the exact permission it enforces: `/yayasan/...` needs
 * content.yayasan, `/smp/...` content.smp, `/sma/...` content.sma.
 */
export function createContentRoutes(host: ContentServerHost) {
  const guard = createGuard(
    (context) => host.resolveActor(getCookie(context, host.sessionCookieName)),
    (actor, rule) => host.allows(actor.id, rule),
  );
  const app = new Hono();
  for (const portal of PORTALS) app.route(`/${portal}`, portalRoutes(host, guard, portal));
  return app;
}

function portalIn(name: string): Portal | undefined {
  return (PORTALS as readonly string[]).includes(name) ? (name as Portal) : undefined;
}

const noPortal = (context: Context) => context.json({ success: false as const, message: 'Not found', code: 'NOT_FOUND' as const }, 404);

/**
 * What the public site reads: each portal's settings and its published
 * entries. On the Yayasan site, news, agenda, gallery, achievements,
 * facilities, staff and documents come from every portal, each entry carrying
 * its portal so the page can label and link it.
 */
export function createSiteRoutes(host: Pick<ContentServerHost, 'images' | 'files'>) {
  return new Hono()
    .get('/:portal', publicRoute, (context) => {
      const portal = portalIn(context.req.param('portal'));
      if (!portal) return noPortal(context);
      const { settings, images, files } = presentSettings(portal, readSettings(portal), host);
      return context.json({ success: true as const, message: 'OK', data: { portal, info: PORTAL_INFO[portal], settings, images, files } });
    })
    .get('/:portal/:type', publicRoute, queryInput(publicListQuerySchema), (context) => {
      const portal = portalIn(context.req.param('portal'));
      const type = portal && typeIn(portal, context.req.param('type'));
      if (!portal || !type) return noPortal(context);
      const query = context.req.valid('query');
      const portals = portal === 'yayasan' && (AGGREGATED_TYPES as readonly string[]).includes(type) ? PORTALS : [portal];
      const { rows, total } = listPublishedRows(portals, type, { page: query.page, limit: query.limit, upcoming: query.upcoming === '1' });
      return context.json({
        success: true as const,
        message: 'OK',
        data: { items: presentPublic(rows, host), total, page: query.page, limit: query.limit } satisfies PublicEntryPage,
      });
    })
    .get('/:portal/:type/:slug', publicRoute, (context) => {
      const portal = portalIn(context.req.param('portal'));
      const type = portal && typeIn(portal, context.req.param('type'));
      if (!portal || !type) return noPortal(context);
      const row = findPublishedRow(portal, type, context.req.param('slug'));
      if (!row) return noPortal(context);
      return context.json({ success: true as const, message: 'OK', data: { entry: presentPublicDetail(row, host) } });
    });
}
