/**
 * appGraph — which modules a pre-rendered page reaches, in the one Vite pass
 * that builds the whole site (`astro.config.ts`).
 *
 * The app's named chunk groups gather the code every app route loads
 * into a few long-cached chunks. A module a reference page also reaches must
 * never join one, or that page would download the whole group and its 20 KB
 * budget would be gone; `pageReaches` is the test the groups add. It is filled
 * in `buildEnd`, after the module graph is complete and before any chunk is
 * made.
 */

import type { Plugin } from 'vite'

type Graph = {
  plugin: Plugin
  /** Whether a pre-rendered page's entry reaches a module, statically or not. */
  pageReaches: (id: string) => boolean
}

/** `pageEntries` are the pre-rendered pages' input modules. */
export function appGraph(options: { pageEntries: readonly string[] }): Graph {
  const pageModules = new Set<string>()

  const plugin: Plugin = {
    name: 'app-graph',
    apply: 'build',
    buildEnd() {
      pageModules.clear()
      const queue = [...options.pageEntries]
      for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
        if (pageModules.has(id)) continue
        pageModules.add(id)
        const info = this.getModuleInfo(id)
        if (info) queue.push(...info.importedIds, ...info.dynamicallyImportedIds)
      }
    },
  }
  return { plugin, pageReaches: (id) => pageModules.has(id) }
}
