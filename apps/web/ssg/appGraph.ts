/**
 * appGraph — which modules and output files belong to which app, in the one
 * Vite pass that builds srd and the Cantina together (`vite.config.ts`).
 *
 * The two apps share a bundle, so a chunk can serve both, and that is the
 * point: React, the UI library and the reference package download once for a
 * reader who crosses from one to the other. Two things must still be split by
 * app, and this records what they need:
 *
 * - **The Cantina's named chunk groups.** Its groups gather the code every
 *   route loads into a few long-cached chunks. A module an srd page also
 *   reaches must never join one, or that page would download the whole group
 *   and srd's 20 KB budget would be gone; `srdReaches` is the test the groups
 *   add. It is filled in `buildEnd`, after the module graph is complete and
 *   before any chunk is made.
 * - **The two service workers' precaches.** srd's worker must not download the
 *   Cantina, and the Cantina's worker, scoped to `/build/`, must precache the
 *   chunks it boots from, which live in the shared `assets/`. `generateBundle`
 *   walks each app's entry chunks: `cantinaOnly` is what srd's worker drops,
 *   and `cantinaPrecache` receives each file the Cantina's worker keeps,
 *   before either worker is generated (`closeBundle`).
 */

import type { Plugin, Rollup } from 'vite'

type OutputBundle = Rollup.OutputBundle
type OutputChunk = Rollup.OutputChunk

/** The Cantina's precache keeps these kinds (its `globPatterns`, `lib/sw/workbox.ts`). */
const PRECACHED = /\.(js|css|ico|png|svg|woff2)$/

/** Its `globIgnores` for the shared folder: the list projection it never loads. */
const NOT_PRECACHED = /actions\.list\.generated-/

type Graph = {
  plugin: Plugin
  /** Whether an srd entry reaches a module, statically or not. */
  srdReaches: (id: string) => boolean
  /** Output files only the Cantina loads, by their path under `dist/`. */
  cantinaOnly: Set<string>
}

/**
 * `srdEntries` are srd's input modules; `srdChunks` and `cantinaChunk` name
 * the entries' chunks (the input keys); `cantinaPrecache` is handed every URL
 * the Cantina's worker precaches from the shared folder.
 */
export function appGraph(options: {
  srdEntries: readonly string[]
  srdChunks: readonly string[]
  cantinaChunk: string
  cantinaPrecache: (url: string) => void
}): Graph {
  const srdModules = new Set<string>()
  const cantinaOnly = new Set<string>()

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
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const srd = filesOf(bundle, (chunk) => options.srdChunks.includes(chunk.name))
        const cantina = filesOf(bundle, (chunk) => chunk.name === options.cantinaChunk)
        if (cantina.size === 0) throw new Error('[app-graph] the bundle has no Cantina entry')
        cantinaOnly.clear()
        for (const file of [...cantina].sort()) {
          if (!srd.has(file)) cantinaOnly.add(file)
          if (PRECACHED.test(file) && !NOT_PRECACHED.test(file)) options.cantinaPrecache(`/${file}`)
        }
      },
    },
  }
  return { plugin, srdReaches: (id) => srdModules.has(id), cantinaOnly }
}

type ViteChunk = OutputChunk & {
  viteMetadata?: { importedCss: Set<string>; importedAssets: Set<string> }
}

/** Every file the matching entry chunks load: their chunks, CSS and assets. */
function filesOf(bundle: OutputBundle, isEntry: (chunk: OutputChunk) => boolean): Set<string> {
  const files = new Set<string>()
  const queue = Object.values(bundle)
    .filter((file): file is OutputChunk => file.type === 'chunk' && file.isEntry && isEntry(file))
    .map((chunk) => chunk.fileName)
  for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
    if (files.has(name)) continue
    files.add(name)
    const chunk = bundle[name]
    if (chunk?.type !== 'chunk') continue
    const meta = (chunk as ViteChunk).viteMetadata
    queue.push(...chunk.imports, ...chunk.dynamicImports)
    for (const file of [...(meta?.importedCss ?? []), ...(meta?.importedAssets ?? [])]) {
      files.add(file)
    }
  }
  return files
}
