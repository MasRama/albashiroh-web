import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  applicationInputSchema,
  applicationQuerySchema,
  exportQuerySchema,
  LEVEL_LABEL,
  ppdbSettingsUpdateSchema,
  registrationSeason,
  reviewSchema,
  type ApplicationPage,
  type PpdbForm,
  type Receipt,
} from '../contract';
import { createGuard, jsonInput, publicRoute, queryInput, validationFailed } from '../../../shared/security';
import type { RoutePolicy } from '../../../shared/security';
import { toCsv, toXlsx } from './export';
import { checkFormToken, issueFormToken } from './form-token';
import type { PpdbServerHost } from './host';
import {
  countApplications,
  deleteApplication,
  exportApplications,
  findApplication,
  formKey,
  insertApplication,
  listApplications,
  readPpdbSettings,
  reviewApplication,
  savePpdbSettings,
} from './repository';

/** A registration is small; anything larger is not from the form. */
export const PPDB_ROUTE_POLICIES = [{ path: '/applications', method: 'POST', bodyMaxBytes: 16 * 1024 }] as const satisfies readonly RoutePolicy[];

function refuse(context: Context, status: 400 | 403 | 404 | 409, message: string, code: string, extra: object = {}) {
  return context.json({ success: false as const, message, code, ...extra }, status);
}

const notFound = (context: Context) => refuse(context, 404, 'Registration not found', 'APPLICATION_NOT_FOUND');

/**
 * The public form (`GET /form`, `POST /applications`) and the committee's
 * API: the list and export need ppdb.view; reviewing, deleting and the
 * settings need ppdb.manage.
 */
export function createPpdbRoutes(host: PpdbServerHost) {
  const now = () => host.now?.() ?? Date.now();
  const guard = createGuard(
    (context) => host.resolveActor(getCookie(context, host.sessionCookieName)),
    (actor, rule) => host.allows(actor.id, rule),
  );
  const canView = guard.allow(host.access.view);
  const canManage = guard.allow(host.access.manage);
  const submitLimit = host.submitLimit ?? (async (_context, next) => next());

  return new Hono()
    .get('/form', publicRoute, (context) => {
      const { settings } = readPpdbSettings();
      context.header('Cache-Control', 'no-store');
      const form: PpdbForm = { open: settings.open, academicYear: settings.academicYear, token: settings.open ? issueFormToken(formKey(), now()) : '' };
      return context.json({ success: true as const, message: 'OK', data: form });
    })
    .post('/applications', publicRoute, submitLimit, async (context) => {
      const { settings } = readPpdbSettings();
      if (!settings.open) return refuse(context, 403, 'Registration is closed', 'PPDB_CLOSED');
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        body = {};
      }
      const spam = body as { website?: unknown; token?: unknown };
      // People never see the website field; only form-filling scripts write in it.
      if (typeof spam.website === 'string' && spam.website.trim() !== '') return refuse(context, 400, 'Registration refused', 'SPAM_REFUSED');
      const token = checkFormToken(formKey(), typeof spam.token === 'string' ? spam.token : '', now());
      if (token === 'too-fast' || token === 'invalid') return refuse(context, 400, 'Registration refused', 'SPAM_REFUSED');
      if (token === 'expired') return refuse(context, 409, 'The form was opened too long ago; reload it', 'FORM_EXPIRED');
      const parsed = applicationInputSchema.safeParse(body);
      if (!parsed.success) return validationFailed(context, parsed.error);
      const { website: _website, token: _token, ...values } = parsed.data;
      const result = insertApplication(values, registrationSeason(settings.academicYear, now()), now());
      if (result.status === 'duplicate') {
        return refuse(context, 409, `This NISN is already registered for ${LEVEL_LABEL[values.level]} this season`, 'ALREADY_REGISTERED');
      }
      const { application } = result;
      const receipt: Receipt = {
        code: application.code,
        level: application.level,
        name: application.student.name,
        createdAt: application.createdAt,
        nextSteps: settings.nextSteps[application.level],
        groupLink: settings.groupLink[application.level],
      };
      return context.json({ success: true as const, message: 'Registered', data: { receipt } }, 201);
    })
    .get('/applications', canView, queryInput(applicationQuerySchema), (context) => {
      const query = context.req.valid('query');
      const { items, total } = listApplications(query);
      const page: ApplicationPage = { items, total, page: query.page, limit: query.limit, counts: countApplications() };
      return context.json({ success: true as const, message: 'OK', data: page });
    })
    .get('/applications/export', canView, queryInput(exportQuerySchema), (context) => {
      const actor = guard.actor(context);
      const { format, ...filter } = context.req.valid('query');
      const applications = exportApplications(filter);
      const stamp = new Date(now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const name = `pendaftar-ppdb${filter.level ? `-${filter.level}` : ''}-${stamp}.${format}`;
      host.report({
        action: 'ppdb.exported',
        resource: 'ppdb',
        actorId: actor.id,
        targetId: null,
        targetLabel: `${applications.length} pendaftar${filter.level ? ` ${LEVEL_LABEL[filter.level]}` : ''}`,
        metadata: { format, level: filter.level ?? 'semua', count: applications.length },
      });
      context.header('Cache-Control', 'no-store');
      context.header('Content-Disposition', `attachment; filename="${name}"`);
      if (format === 'csv') {
        context.header('Content-Type', 'text/csv; charset=utf-8');
        return context.body(new Uint8Array(toCsv(applications)));
      }
      context.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return context.body(new Uint8Array(toXlsx(applications)));
    })
    .get('/applications/:id', canView, (context) => {
      const application = findApplication(context.req.param('id'));
      if (!application) return notFound(context);
      return context.json({ success: true as const, message: 'OK', data: { application } });
    })
    .patch('/applications/:id', canManage, jsonInput(reviewSchema), (context) => {
      const actor = guard.actor(context);
      const input = context.req.valid('json');
      const result = reviewApplication(context.req.param('id'), { status: input.status, note: input.note }, input.revision, now());
      if (result.status === 'missing') return notFound(context);
      if (result.status === 'stale') {
        return refuse(context, 409, 'Someone else changed this registration since you opened it', 'STALE_REVISION', { current: result.application });
      }
      const { application } = result;
      host.report({ action: 'ppdb.reviewed', resource: 'ppdb', actorId: actor.id, targetId: application.id, targetLabel: application.code, metadata: { status: application.status } });
      return context.json({ success: true as const, message: 'Saved', data: { application } });
    })
    .delete('/applications/:id', canManage, (context) => {
      const actor = guard.actor(context);
      const removed = deleteApplication(context.req.param('id'));
      if (!removed) return notFound(context);
      host.report({ action: 'ppdb.deleted', resource: 'ppdb', actorId: actor.id, targetId: removed.id, targetLabel: removed.code, metadata: { level: removed.level } });
      return context.json({ success: true as const, message: 'Deleted', data: { id: removed.id } });
    })
    .get('/settings', canManage, (context) => context.json({ success: true as const, message: 'OK', data: { record: readPpdbSettings() } }))
    .put('/settings', canManage, jsonInput(ppdbSettingsUpdateSchema), (context) => {
      const actor = guard.actor(context);
      const input = context.req.valid('json');
      const result = savePpdbSettings(input.settings, input.revision, actor.id, now());
      if (result.status === 'stale') {
        return refuse(context, 409, 'Someone else changed these settings since you opened them', 'STALE_REVISION', { current: result.record });
      }
      host.report({ action: 'ppdb.configured', resource: 'ppdb', actorId: actor.id, targetId: null, targetLabel: input.settings.open ? 'Formulir dibuka' : 'Formulir ditutup', metadata: { open: input.settings.open } });
      return context.json({ success: true as const, message: 'Saved', data: { record: result.record } });
    });
}
