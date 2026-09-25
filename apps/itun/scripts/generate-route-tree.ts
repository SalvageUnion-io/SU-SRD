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
import { existsSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { unpluginRouterGeneratorFactory } from '@tanstack/router-plugin'
import { ROUTER_PLUGIN_OPTIONS } from '../routeTree.config'

type ConfigResolvedHook = (config: { root: string }) => Promise<void>

const plugin = unpluginRouterGeneratorFactory(ROUTER_PLUGIN_OPTIONS, {
  framework: 'vite',
  versions: {},
})
const hooks = (Array.isArray(plugin) ? plugin[0] : plugin) as {
  vite?: { configResolved?: unknown }
}
const configResolved = hooks.vite?.configResolved as ConfigResolvedHook | undefined
if (typeof configResolved !== 'function') {
  console.error('generate-route-tree: the router plugin no longer exposes vite.configResolved')
  process.exit(1)
}

// Move the committed tree aside first. The generator skips the write when the
// content is unchanged, so "the file exists afterwards" is the only proof it
// ran — without this, a plugin upgrade that keeps the hook but stops
// generating there would write nothing, exit 0, and leave check-generated
// comparing the committed file against itself.
const root = join(import.meta.dir, '..')
const target = join(root, ROUTER_PLUGIN_OPTIONS.generatedRouteTree)
const backup = `${target}.bak`
const hadTarget = existsSync(target)
if (hadTarget) renameSync(target, backup)
try {
  await configResolved({ root })
} finally {
  if (!existsSync(target)) {
    if (hadTarget) renameSync(backup, target)
    console.error(`generate-route-tree: the router plugin did not write ${target}`)
    process.exit(1)
  }
  if (hadTarget) rmSync(backup)
}
