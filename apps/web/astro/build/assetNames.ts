/**
 * assetNames — what the build calls its hashed files, and the refusal that
 * keeps every one a name a URL path carries as written.
 *
 * Astro names a page's stylesheet after its module id (`index@_@astro`), and
 * Workers Static Assets answers an `@` with a redirect to `%40`, which
 * browsers then follow until they give up: the page waits on a stylesheet
 * that never loads.
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Any character a URL path would percent-encode becomes `_`. */
export const urlSafeName = (name: string): string => name.replace(/[^\w.-]/g, '_')

const stem = (file: string): string => file.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '')

/** `name-hash`, as the bundle-budget specs match chunks by prefix (`e2e/_bundle.ts`). */
export const HASHED_NAMES = {
  entryFileNames: (chunk: { name: string }) => `assets/${urlSafeName(chunk.name)}-[hash].js`,
  chunkFileNames: (chunk: { name: string }) => `assets/${urlSafeName(chunk.name)}-[hash].js`,
  assetFileNames: (asset: { names?: readonly string[] }) =>
    `assets/${urlSafeName(stem(asset.names?.[0] ?? 'asset'))}-[hash][extname]`,
}

/** The files in `assets/` whose names a URL path would have to encode. */
export function unsafeAssetNames(files: readonly string[]): string[] {
  return files.filter((file) => urlSafeName(file) !== file)
}

/** Refuse a build that wrote an asset a browser cannot fetch by its own name. */
export async function assertUrlSafeAssets(distDir: string): Promise<void> {
  const unsafe = unsafeAssetNames(await readdir(join(distDir, 'assets')))
  if (unsafe.length > 0) {
    throw new Error(
      `[build] refusing to finish: asset names a URL must encode (${unsafe.join(', ')}); name them through HASHED_NAMES in astro/build/assetNames.ts`
    )
  }
}
