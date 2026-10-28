/**
 * bootPreload — the app's shell names, in its head, the chunks its first render
 * waits on, so the browser fetches them alongside the entry rather than one
 * round trip after another.
 *
 * Unhinted, the shell links one small entry script; its imports (React, the
 * app) are found only once it arrives, and the reference data only once those
 * have run (`routes/__root.tsx`'s preload). The shell's head now preloads:
 *
 * - the entry's static imports, every time;
 * - the reference data the first render waits on: the front door's few
 *   schemas when the document opens on it (`FRONT_DOOR_ATTRIBUTE`, set by the
 *   head script before this one), else every schema (`GameDataReady`).
 *
 * The chunk names are known only once the client pass has bundled, so
 * `bootPreloadPlugin` records them and `site` writes them into the built
 * shell before it collects the inline scripts' hashes.
 */

import type { Plugin } from 'vite'
import { FRONT_DOOR_ATTRIBUTE, FRONT_DOOR_SCHEMAS } from '../../src/build/roster/frontDoorData'

/** The shell's page, whose script is the app's entry (`astro/pages/build/index.astro`). */
const SHELL_PAGE = /[\\/]astro[\\/]pages[\\/]build[\\/]index\.astro\?/

/** A schema's data module in the reference package, by schema id; not a list projection. */
const SCHEMA_DATA = /[\\/]salvageunion-reference[\\/]data[\\/]([a-z-]+)\.json$/

type Emitted = { entryImports: string[]; schemas: Map<string, string> }

/** What the client pass emitted, for `site` (one build, one process). */
let emitted: Emitted | undefined

/** Records the shell entry's static imports and each schema's data chunk. */
export function bootPreloadPlugin(): Plugin {
  return {
    name: 'boot-preload',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).flatMap((file) => (file.type === 'chunk' ? [file] : []))
      const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
      const entry = chunks.find((chunk) => SHELL_PAGE.test(chunk.facadeModuleId ?? ''))
      if (!entry) throw new Error('[boot-preload] the app shell entry chunk is missing')

      const entryImports = new Set<string>()
      const visit = (fileName: string) => {
        if (entryImports.has(fileName)) return
        entryImports.add(fileName)
        for (const next of byName.get(fileName)?.imports ?? []) visit(next)
      }
      for (const next of entry.imports) visit(next)

      const schemas = new Map<string, string>()
      for (const chunk of chunks) {
        const id = SCHEMA_DATA.exec(chunk.facadeModuleId ?? '')?.[1]
        if (id) schemas.set(id, chunk.fileName)
      }
      emitted = { entryImports: [...entryImports], schemas }
    },
  }
}

const href = (fileName: string) => `/${fileName}`

/** The head script: the data chunks for the document's first render, as modulepreloads. */
export function bootPreloadScript(schemas: Map<string, string>): string {
  const all = [...schemas.values()].map(href)
  const frontDoor = FRONT_DOOR_SCHEMAS.map((id) => {
    const fileName = schemas.get(id)
    if (!fileName) throw new Error(`[boot-preload] no data chunk for the front door's '${id}'`)
    return href(fileName)
  })
  return `(function(){var f=${JSON.stringify(frontDoor)},a=${JSON.stringify(all)};(document.documentElement.hasAttribute(${JSON.stringify(FRONT_DOOR_ATTRIBUTE)})?f:a).forEach(function(h){var l=document.createElement('link');l.rel='modulepreload';l.href=h;document.head.appendChild(l)})})()`
}

/** `html` (the built shell) with its boot preloads at the end of its head. */
export function withBootPreload(html: string): string {
  if (!emitted) throw new Error('[boot-preload] the client pass recorded no chunks')
  const links = emitted.entryImports
    .map((fileName) => `<link rel="modulepreload" href="${href(fileName)}">`)
    .join('')
  const script = `<script>${bootPreloadScript(emitted.schemas)}</script>`
  if (!html.includes('</head>')) throw new Error('[boot-preload] the shell has no </head>')
  return html.replace('</head>', `${links}${script}</head>`)
}
