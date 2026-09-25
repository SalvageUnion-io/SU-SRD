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
await configResolved({ root: join(import.meta.dir, '..') })
