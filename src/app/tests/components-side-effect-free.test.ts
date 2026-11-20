import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The production build marks every `src/**\/*.vue` module side-effect free
 * (vite.config.mjs, componentsAreSideEffectFree), so a page only ships the
 * components it renders. That holds only while components keep their code in
 * `<script setup>`: a plain `<script>` block runs at import time, and its
 * module-level work would be dropped from the build without a warning.
 */
const SRC = join(__dirname, '..', '..');

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : vueFiles(path);
    return entry.name.endsWith('.vue') ? [path] : [];
  });
}

/** Opening `<script>` tags that are not `<script setup>`. */
function plainScriptBlocks(source: string): string[] {
  return [...source.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]).filter((tag) => !/\ssetup(\s|=|>)/.test(tag));
}

describe('components stay side-effect free', () => {
  it('spots a plain script block next to script setup', () => {
    expect(plainScriptBlocks('<script setup lang="ts">\nconst a = 1;\n</script>')).toEqual([]);
    expect(plainScriptBlocks('<script lang="ts">\nwindow.x = 1;\n</script>\n<script setup lang="ts"></script>')).toEqual(['<script lang="ts">']);
    expect(plainScriptBlocks('<script>\nexport default {};\n</script>')).toEqual(['<script>']);
  });

  it('keeps every component in src on script setup only', () => {
    const files = vueFiles(SRC);
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((file) => plainScriptBlocks(readFileSync(file, 'utf8')).length > 0).map((file) => relative(SRC, file));
    expect(offenders, 'Move this code into <script setup>, or drop the file from componentsAreSideEffectFree in vite.config.mjs').toEqual([]);
  });
});
