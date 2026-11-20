import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDatabase } from '../../../shared/database';
import type { AccessRule } from '../../../shared/security/access';
import { createPpdbRoutes, ppdbAccess, type Application, type PpdbServerHost } from '..';
import { MIN_FILL_MS, PPDB_REFUSAL_CODES, type ApplicationInput, type ApplicationPage, type PpdbForm, type PpdbSettings, type Receipt } from '../contract';

/**
 * PPDB's routes with a stand-in host and clock: a committee member who may
 * read, one who may also manage, and visitors with no session. Every name
 * and number here is made up.
 */
const READER = 'reader';
const MANAGER = 'manager';
const GRANTS: Record<string, string[]> = { [READER]: ['ppdb.view'], [MANAGER]: ['ppdb.view', 'ppdb.manage'] };

let clock = Date.parse('2026-11-20T03:00:00Z');
const reports: { action: string; targetLabel?: string | null; metadata?: unknown }[] = [];
const host: PpdbServerHost = {
  sessionCookieName: 'sid',
  resolveActor: (token) => (token && GRANTS[token] ? { id: token } : undefined),
  access: ppdbAccess('ppdb'),
  allows: (actorId, rule: AccessRule) => 'permission' in rule && GRANTS[actorId]?.includes(rule.permission) === true,
  report: (activity) => reports.push(activity),
  now: () => clock,
};
const app = new Hono().route('/api/ppdb', createPpdbRoutes(host));

function send(actor: string | null, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (actor) headers.Cookie = `sid=${actor}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return app.request(`/api/ppdb${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const data = async <T>(response: Response): Promise<T> => ((await response.json()) as { data: T }).data;

async function settings(change: Partial<PpdbSettings>): Promise<void> {
  const { record } = await data<{ record: { settings: PpdbSettings; revision: number } }>(await send(MANAGER, 'GET', '/settings'));
  const response = await send(MANAGER, 'PUT', '/settings', { settings: { ...record.settings, ...change }, revision: record.revision });
  expect(response.status, await response.clone().text()).toBe(200);
}

/** Opens the form as a visitor and waits as long as a person takes to fill it. */
async function openForm(): Promise<string> {
  const form = await data<PpdbForm>(await send(null, 'GET', '/form'));
  clock += MIN_FILL_MS + 30_000;
  return form.token;
}

function applicant(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
  const parent = (name: string, nik: string) => ({ name, nik, birthYear: 1985, education: 'S1' as const, job: 'Swasta / Wiraswasta' as const, income: 'Rp1.000.000 – Rp3.000.000' as const });
  return {
    level: 'smp',
    student: { name: 'Ahmad Contoh', birthPlace: 'Malang', birthDate: '2014-05-17', gender: 'L', nisn: '0012345678', previousSchool: 'SD Contoh 1' },
    father: parent('Budi Contoh', '3507000000000001'),
    mother: parent('Siti Contoh', '3507000000000002'),
    address: 'Jl. Contoh No. 1 RT 01 RW 02, Turen',
    postalCode: '65175',
    phone: '0812 3456 7890',
    boarding: 'bersedia',
    payment: 'transfer',
    website: '',
    token: '',
    ...overrides,
  };
}

async function register(overrides: Partial<ApplicationInput> = {}): Promise<Response> {
  const token = await openForm();
  return send(null, 'POST', '/applications', applicant({ token, ...overrides }));
}

beforeEach(async () => {
  getDatabase().prepare('DELETE FROM ppdb_applications').run();
  getDatabase().prepare('DELETE FROM ppdb_settings').run();
  reports.length = 0;
  clock = Date.parse('2026-11-20T03:00:00Z');
  await settings({ open: true, academicYear: '2027/2028', nextSteps: { smp: 'Transfer infaq ke rekening SMP.', sma: 'Transfer infaq ke rekening SMA.' }, groupLink: { smp: 'https://chat.whatsapp.com/contoh-smp', sma: '' } });
});

describe('the public registration form', () => {
  it('registers an applicant with the next number for the level and hands back the school’s next steps', async () => {
    const first = await register();
    expect(first.status, await first.clone().text()).toBe(201);
    const { receipt } = await data<{ receipt: Receipt }>(first);
    expect(receipt).toEqual({
      code: 'SMP-2026-0001',
      level: 'smp',
      name: 'Ahmad Contoh',
      createdAt: clock,
      nextSteps: 'Transfer infaq ke rekening SMP.',
      groupLink: 'https://chat.whatsapp.com/contoh-smp',
    });

    const second = await register({ student: { ...applicant().student, name: 'Fatimah Contoh', gender: 'P', nisn: '0012345679' } });
    expect((await data<{ receipt: Receipt }>(second)).receipt.code).toBe('SMP-2026-0002');
    const sma = await register({ level: 'sma', student: { ...applicant().student, birthDate: '2011-02-01', nisn: '0098765432' } });
    expect((await data<{ receipt: Receipt }>(sma)).receipt).toMatchObject({ code: 'SMA-2026-0001', groupLink: '' });

    const row = getDatabase().prepare("SELECT phone, data FROM ppdb_applications WHERE code = 'SMP-2026-0001'").get() as { phone: string; data: string };
    expect(row.phone).toBe('6281234567890');
    expect(JSON.parse(row.data)).not.toHaveProperty('token');
  });

  it('refuses the same NISN twice for one level in a year, but takes it for the other level', async () => {
    expect((await register()).status).toBe(201);
    const again = await register();
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: 'ALREADY_REGISTERED' });
    expect((await register({ level: 'sma', student: { ...applicant().student, birthDate: '2011-02-01' } })).status).toBe(201);
  });

  it('names each field a person must fix', async () => {
    const response = await register({
      student: { ...applicant().student, nisn: '12345', birthDate: '2014-02-30' },
      father: { ...applicant().father, nik: '3507' },
      postalCode: 'abc',
      phone: '12',
    });
    expect(response.status).toBe(422);
    const { errors } = (await response.json()) as { errors: Record<string, string[]> };
    expect(Object.keys(errors).sort()).toEqual(['father.nik', 'phone', 'postalCode', 'student.birthDate', 'student.nisn']);
    expect(errors['student.nisn']).toEqual(['NISN berisi 10 angka, lihat di rapor atau ijazah']);
  });

  it('turns away scripts: a filled hidden field, no opened form, or a post within seconds', async () => {
    const honeypot = await register({ website: 'https://spam.example' });
    expect(honeypot.status).toBe(400);
    expect(await honeypot.json()).toMatchObject({ code: 'SPAM_REFUSED' });

    expect((await send(null, 'POST', '/applications', applicant({ token: '' }))).status).toBe(400);
    expect((await send(null, 'POST', '/applications', applicant({ token: `${clock.toString(36)}.forged` }))).status).toBe(400);

    const form = await data<PpdbForm>(await send(null, 'GET', '/form'));
    clock += 1_000;
    expect((await send(null, 'POST', '/applications', applicant({ token: form.token }))).status).toBe(400);

    clock += 13 * 60 * 60 * 1000;
    const stale = await send(null, 'POST', '/applications', applicant({ token: form.token }));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'FORM_EXPIRED' });

    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM ppdb_applications').get()).toEqual({ count: 0 });
  });

  it('takes no registration while the committee keeps the form closed', async () => {
    const token = await openForm();
    await settings({ open: false });
    expect(await data<PpdbForm>(await send(null, 'GET', '/form'))).toEqual({ open: false, academicYear: '2027/2028', token: '' });
    const response = await send(null, 'POST', '/applications', applicant({ token }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'PPDB_CLOSED' });
  });
});

describe('the committee', () => {
  async function seedThree(): Promise<void> {
    await register();
    await register({ student: { ...applicant().student, name: 'Fatimah Contoh', gender: 'P', nisn: '0012345679' } });
    await register({ level: 'sma', student: { ...applicant().student, name: 'Umar Contoh', birthDate: '2011-02-01', nisn: '0098765432', previousSchool: 'SMP Contoh 2' } });
  }

  it('lists registrations by level with search and counts, and keeps them from visitors', async () => {
    await seedThree();
    expect((await send(null, 'GET', '/applications')).status).toBe(401);

    const smp = await data<ApplicationPage>(await send(READER, 'GET', '/applications?level=smp'));
    expect(smp.items.map((item) => item.code)).toEqual(['SMP-2026-0002', 'SMP-2026-0001']);
    expect(smp.counts).toEqual({ smp: { baru: 2, diverifikasi: 0, diterima: 0, ditolak: 0 }, sma: { baru: 1, diverifikasi: 0, diterima: 0, ditolak: 0 } });

    const found = await data<ApplicationPage>(await send(READER, 'GET', '/applications?q=SMP%20Contoh%202'));
    expect(found.items.map((item) => item.name)).toEqual(['Umar Contoh']);
  });

  it('reviews a registration only with the manage permission, and merges no stale save', async () => {
    await seedThree();
    const [item] = (await data<ApplicationPage>(await send(READER, 'GET', '/applications?level=sma'))).items;
    const { application } = await data<{ application: Application }>(await send(READER, 'GET', `/applications/${item!.id}`));
    expect(application).toMatchObject({ code: 'SMA-2026-0001', father: { nik: '3507000000000001' }, status: 'baru', revision: 1 });

    expect((await send(READER, 'PATCH', `/applications/${item!.id}`, { status: 'diterima', note: '', revision: 1 })).status).toBe(403);
    const saved = await send(MANAGER, 'PATCH', `/applications/${item!.id}`, { status: 'diterima', note: 'Berkas lengkap.', revision: 1 });
    expect((await data<{ application: Application }>(saved)).application).toMatchObject({ status: 'diterima', note: 'Berkas lengkap.', revision: 2 });
    expect((await send(MANAGER, 'PATCH', `/applications/${item!.id}`, { status: 'ditolak', note: '', revision: 1 })).status).toBe(409);
    expect(reports.at(-1)).toMatchObject({ action: 'ppdb.reviewed', targetLabel: 'SMA-2026-0001' });

    expect((await send(READER, 'DELETE', `/applications/${item!.id}`)).status).toBe(403);
    expect((await send(MANAGER, 'DELETE', `/applications/${item!.id}`)).status).toBe(200);
    expect((await send(READER, 'GET', `/applications/${item!.id}`)).status).toBe(404);
  });

  it('exports a level as CSV that no spreadsheet runs as a formula', async () => {
    await seedThree();
    await register({ level: 'sma', student: { ...applicant().student, name: '=HYPERLINK("x")', birthDate: '2011-02-01', nisn: '0098765433' } });
    const response = await send(READER, 'GET', '/applications/export?format=csv&level=sma');
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="pendaftar-ppdb-sma-2026-11-20.csv"');
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await response.arrayBuffer());
    expect(text.startsWith('﻿No. pendaftaran,Tanggal daftar,Jenjang,Status,Nama lengkap,')).toBe(true);
    const lines = text.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('SMA-2026-0001,2026-11-20,SMA,Baru,Umar Contoh,Malang,2011-02-01,Laki-laki,0098765432,SMP Contoh 2,');
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(reports.at(-1)).toMatchObject({ action: 'ppdb.exported', targetLabel: '2 pendaftar SMA', metadata: { format: 'csv', level: 'sma', count: 2 } });
  });

  it('exports an Excel workbook whose numbers stay text', async () => {
    await seedThree();
    const response = await send(READER, 'GET', '/applications/export?format=xlsx');
    expect(response.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const files = unzip(Buffer.from(await response.arrayBuffer()));
    expect([...files.keys()].sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
    const sheet = files.get('xl/worksheets/sheet1.xml')!;
    expect(sheet.match(/<row /g)).toHaveLength(4);
    expect(sheet).toContain('<c r="L2" t="inlineStr"><is><t xml:space="preserve">3507000000000001</t></is></c>');
    expect(sheet).toContain('<c r="I2" t="inlineStr"><is><t xml:space="preserve">0012345678</t></is></c>');
    expect(sheet).toContain('<autoFilter ref="A1:AB4"/>');
  });

  it('keeps the form settings to managers', async () => {
    expect((await send(READER, 'GET', '/settings')).status).toBe(403);
    const response = await send(MANAGER, 'PUT', '/settings', { settings: { open: true, groupLink: { smp: 'javascript:alert(1)', sma: '' } }, revision: 1 });
    expect(response.status).toBe(422);
  });
});

describe('the contract', () => {
  it('declares every refusal code the routes send', () => {
    const source = readFileSync('src/features/ppdb/server/routes.ts', 'utf8');
    const sent = [...source.matchAll(/, '([A-Z][A-Z0-9_]+)'(?=\)|, \{)/g)].map((match) => match[1]!);
    expect(new Set(sent)).toEqual(new Set(['APPLICATION_NOT_FOUND', 'PPDB_CLOSED', 'SPAM_REFUSED', 'FORM_EXPIRED', 'ALREADY_REGISTERED', 'STALE_REVISION']));
    expect(sent.filter((code) => !(PPDB_REFUSAL_CODES as readonly string[]).includes(code))).toEqual([]);
  });
});

/** Reads a ZIP archive's entries by walking its local headers, as Excel would. */
function unzip(archive: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  let offset = 0;
  while (archive.readUInt32LE(offset) === 0x04034b50) {
    const size = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extra = archive.readUInt16LE(offset + 28);
    const name = archive.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extra;
    files.set(name, inflateRawSync(archive.subarray(start, start + size)).toString('utf8'));
    offset = start + size;
  }
  return files;
}
