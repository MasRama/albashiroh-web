import path from 'node:path';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

describe('Vue frontend production build', () => {
  it('includes utility styles used by Feature-owned pages', async () => {
    const result = await build({
      configFile: path.resolve(process.cwd(), 'vite.config.mjs'),
      mode: 'production',
      build: { write: false },
    });
    const outputs = Array.isArray(result) ? result.flatMap((environment) => environment.output) : result.output;
    // Pages loaded on demand bring their own stylesheets; the utilities may sit in any of them.
    const stylesheets = outputs.filter((output) => output.type === 'asset' && output.fileName.endsWith('.css'));
    expect(stylesheets.length).toBeGreaterThan(0);
    const css = stylesheets
      .map((output) => (output.type !== 'asset' ? '' : typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source)))
      .join('\n');
    // Utilities that only Feature pages use prove Tailwind scans src/features.
    expect(css).toContain('.gap-3\\.5');
    expect(css).toContain('.text-\\[13px\\]');
    expect(css).toContain('--nara-bg:#f6f5ef');
  }, 30_000); // A real Vite build can exceed the 5s default while the suite runs in parallel.

  it('keeps the admin and its component kit out of what a public visitor downloads first', async () => {
    const result = await build({
      configFile: path.resolve(process.cwd(), 'vite.config.mjs'),
      mode: 'production',
      build: { write: false },
      logLevel: 'silent',
    });
    const outputs = Array.isArray(result) ? result.flatMap((environment) => environment.output) : result.output;
    const chunks = new Map(outputs.flatMap((output) => (output.type === 'chunk' ? [[output.fileName, output] as const] : [])));
    const entry = [...chunks.values()].find((chunk) => chunk.isEntry);
    expect(entry).toBeDefined();
    // The entry and everything it imports statically load on the first visit to any page.
    const loaded = new Set<string>();
    const visit = (fileName: string): void => {
      if (loaded.has(fileName)) return;
      loaded.add(fileName);
      for (const next of chunks.get(fileName)?.imports ?? []) visit(next);
    };
    visit(entry!.fileName);
    const modules = [...loaded].flatMap((fileName) => chunks.get(fileName)?.moduleIds ?? []).map((id) => path.relative(process.cwd(), id.split('?')[0]!));
    const admin = modules.filter(
      (id) => id.startsWith('src/shared/ui/components/') || id.startsWith('src/app/pages/admin/') || id.startsWith('src/app/layouts/AdminShell') || /src\/features\/[^/]+\/web\/(components|pages)\//.test(id),
    );
    expect(admin).toEqual([]);
  }, 30_000);
});
