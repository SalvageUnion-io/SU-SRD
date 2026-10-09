/**
 * generate-route-tree — regenerate `src/routeTree.gen.ts` without a build.
 *
 * The tree is normally written by TanStack Router's Vite plugin as a side
 * effect of `vite build` / `vite dev`. That made its drift check an inline
 * step in CI's `build-itun` job and nothing else: locally, and in `bun run
 * check`, a stale committed tree was invisible until CI rebuilt the app.
 * `tools/check-generated.ts` runs this instead — the plugin's own generator,
 * with the same options object the Vite config uses, in ~300 ms.
 *
 * Usage: bun apps/itun/scripts/generate-route-tree.ts
 */
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { unpluginRouterGeneratorFactory } from '@tanstack/router-plugin'
import { ROUTER_PLUGIN_OPTIONS } from '../routeTree.config'

type ConfigResolvedHook = (config: { root: string }) => Promise<void>

/**
 * Run `generate` into a scratch file beside `target`, then swap it in.
 *
 * The committed tree is never moved, truncated or deleted: the scratch file
 * replaces it with one atomic rename, and only when the content differs. The
 * pre-push hook runs `tools/check-generated.ts` alongside the test suite, and
 * tests read every tracked file — this used to move the tree aside while the
 * generator ran, and a test reading it in that window failed with ENOENT.
 *
 * The scratch file starts absent, so "it exists afterwards" proves the
 * generator ran: a plugin upgrade that keeps the hook but stops writing fails
 * here instead of leaving check-generated comparing the committed file
 * against itself. It sits in the same directory so the generator's relative
 * imports come out identical.
 */
export async function replaceAtomically(
  target: string,
  generate: (scratch: string) => Promise<void>
): Promise<'unchanged' | 'replaced'> {
  const scratch = join(dirname(target), `.${basename(target, '.ts')}.${process.pid}.ts`)
  rmSync(scratch, { force: true })
  try {
    await generate(scratch)
    if (!existsSync(scratch)) throw new Error(`the generator did not write ${scratch}`)
    const next = readFileSync(scratch)
    if (existsSync(target) && readFileSync(target).equals(next)) return 'unchanged'
    renameSync(scratch, target)
    return 'replaced'
  } finally {
    rmSync(scratch, { force: true })
  }
}

async function generateRouteTree(root: string, scratch: string): Promise<void> {
  const plugin = unpluginRouterGeneratorFactory(
    { ...ROUTER_PLUGIN_OPTIONS, generatedRouteTree: `./${relative(root, scratch)}` },
    { framework: 'vite', versions: {} }
  )
  const hooks = (Array.isArray(plugin) ? plugin[0] : plugin) as {
    vite?: { configResolved?: unknown }
  }
  const configResolved = hooks.vite?.configResolved as ConfigResolvedHook | undefined
  if (typeof configResolved !== 'function') {
    throw new Error('the router plugin no longer exposes vite.configResolved')
  }
  await configResolved({ root })
}

if (import.meta.main) {
  const root = join(import.meta.dir, '..')
  const target = join(root, ROUTER_PLUGIN_OPTIONS.generatedRouteTree)
  try {
    await replaceAtomically(target, (scratch) => generateRouteTree(root, scratch))
  } catch (error) {
    console.error(`generate-route-tree: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}
