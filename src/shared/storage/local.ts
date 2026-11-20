import { mkdir, readFile, realpath, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AssetStorage, AssetStoragePutInput } from './contract';

function validStorageKey(key: string): boolean {
  if (!key || key.startsWith('/') || key.includes('\\')) return false;
  const segments = key.split('/');
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== '.' &&
      segment !== '..' &&
      /^[A-Za-z0-9._-]+$/.test(segment),
  );
}

function storageTarget(root: string, key: string): string {
  if (!validStorageKey(key)) throw new Error(`Invalid asset storage key "${key}"`);
  const target = path.resolve(root, ...key.split('/'));
  if (target === root || !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Asset storage key escapes configured root: "${key}"`);
  }
  return target;
}

/** Removes the folders a delete left empty, up to (never including) the root. */
async function removeEmptyParents(root: string, directory: string): Promise<void> {
  for (let current = directory; current.startsWith(`${root}${path.sep}`); current = path.dirname(current)) {
    try {
      await rmdir(current);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOTEMPTY' || code === 'EEXIST' || code === 'ENOENT') return;
      throw error;
    }
  }
}

export interface LocalAssetStorageOptions {
  root: string;
}

export function createLocalAssetStorage(options: LocalAssetStorageOptions): AssetStorage {
  const root = path.resolve(options.root);

  return {
    async put(input: AssetStoragePutInput): Promise<void> {
      const target = storageTarget(root, input.key);
      const parent = path.dirname(target);
      await mkdir(parent, { recursive: true });
      const [resolvedRoot, resolvedParent] = await Promise.all([realpath(root), realpath(parent)]);
      if (resolvedParent !== resolvedRoot && !resolvedParent.startsWith(`${resolvedRoot}${path.sep}`)) {
        throw new Error(`Asset storage key resolves outside configured root: "${input.key}"`);
      }
      await writeFile(target, input.data, { flag: 'wx' });
    },

    async get(key: string) {
      const target = storageTarget(root, key);
      try {
        const [resolvedRoot, resolvedTarget] = await Promise.all([realpath(root), realpath(target)]);
        if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) return undefined;
        const [data, metadata] = await Promise.all([readFile(resolvedTarget), stat(resolvedTarget)]);
        return {
          data,
          size: metadata.size,
        };
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'ENOENT' ? undefined : Promise.reject(error);
      }
    },

    async delete(key: string): Promise<boolean> {
      const target = storageTarget(root, key);
      try {
        const [resolvedRoot, resolvedTarget] = await Promise.all([realpath(root), realpath(target)]);
        if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) return false;
        await unlink(resolvedTarget);
        await removeEmptyParents(resolvedRoot, path.dirname(resolvedTarget));
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
        throw error;
      }
    },
  };
}
