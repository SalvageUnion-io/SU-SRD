/**
 * appGraph — which modules a pre-rendered page reaches, in the one Vite pass
 * that builds the whole site (`vite.config.ts`).
 *
 * The builder's named chunk groups gather the code every builder route loads
 * into a few long-cached chunks. A module a reference page also reaches must
 * never join one, or that page would download the whole group and its 20 KB
 * budget would be gone; `srdReaches` is the test the groups add. It is filled
 * in `buildEnd`, after the module graph is complete and before any chunk is
 * made.
 */

import type { Plugin } from 'vite'

type Graph = {
  plugin: Plugin
  /** Whether a pre-rendered page's entry reaches a module, statically or not. */
  srdReaches: (id: string) => boolean
}

/** `srdEntries` are the pre-rendered pages' input modules. */
export function appGraph(options: { srdEntries: readonly string[] }): Graph {
  const srdModules = new Set<string>()

  const plugin: Plugin = {
    name: 'app-graph',
    apply: 'build',
    buildEnd() {
      srdModules.clear()
      const queue = [...options.srdEntries]
      for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
        if (srdModules.has(id)) continue
        srdModules.add(id)
        const info = this.getModuleInfo(id)
        if (info) queue.push(...info.importedIds, ...info.dynamicallyImportedIds)
      }
    },
  }
  return { plugin, srdReaches: (id) => srdModules.has(id) }
}
