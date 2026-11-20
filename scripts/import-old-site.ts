import { resolve } from 'node:path';
import { importOldSiteFile, type OldPortal, type PortalImport } from '../src/app/old-site-import';
import { closeDatabase, getDatabasePath, migrate } from '../src/shared/database';
import { createLocalAssetStorage } from '../src/shared/storage';

const USAGE = `Imports the old SMP and SMA sites into this database.

  npm run import:old-site -- --smp <old smp .db> --sma <old sma .db>

Either school may be left out. The old files are never written to: each is
copied to a temp folder and the copy is opened read-only. Running it again
adds only records not imported before and leaves edited entries alone.
`;

function parse(argv: string[]): Partial<Record<OldPortal, string>> {
  const files: Partial<Record<OldPortal, string>> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--help' || flag === '-h') return {};
    if (flag !== '--smp' && flag !== '--sma') throw new Error(`Unknown option ${flag}\n\n${USAGE}`);
    const file = argv[index + 1];
    if (!file || file.startsWith('--')) throw new Error(`${flag} needs a file\n\n${USAGE}`);
    files[flag.slice(2) as OldPortal] = resolve(file);
    index += 1;
  }
  return files;
}

function print(report: PortalImport): void {
  process.stdout.write(`\n${report.portal.toUpperCase()}\n`);
  process.stdout.write('  type        found  new  already  refused  no photo  drafts\n');
  // Types the old site never had stay out of the table.
  for (const tally of report.types.filter((entry) => entry.found > 0)) {
    const cells = [tally.found, tally.imported, tally.existing, tally.invalid, tally.withoutImage, tally.drafts].map((value, index) => String(value).padStart([5, 5, 9, 9, 10, 8][index]!));
    process.stdout.write(`  ${tally.type.padEnd(10)}${cells.join('')}\n`);
  }
  process.stdout.write(`  Photos recovered from article bodies: ${report.recoveredPhotos}\n`);
  process.stdout.write(`  Settings filled: ${report.settings.length > 0 ? report.settings.join(', ') : 'none (already set)'}\n`);
  process.stdout.write('  Not imported: the old admissions page (form link, payment details); set them in Admin > PPDB > Pengaturan.\n');
  for (const problem of report.problems) process.stdout.write(`  ! ${problem}\n`);
}

async function run(): Promise<void> {
  const files = parse(process.argv.slice(2));
  const portals = (['smp', 'sma'] as const).filter((portal) => files[portal]);
  if (portals.length === 0) {
    process.stdout.write(USAGE);
    return;
  }
  const migrations = migrate();
  process.stdout.write(`Database: ${getDatabasePath()} (migrations applied: ${migrations.applied.length})\n`);
  const storage = createLocalAssetStorage({ root: resolve(process.cwd(), 'storage') });
  for (const portal of portals) print(await importOldSiteFile(portal, files[portal]!, storage));
}

void run()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
