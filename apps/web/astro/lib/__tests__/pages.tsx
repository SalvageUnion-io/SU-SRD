/**
 * The pages the build emits from `astro/pages/**.astro`, rendered without a
 * build: each shell names the page module it wraps (`import { x as module }`),
 * and this renders that module through `../document`, as the shell does, with
 * stand-in assets.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { ColumnsTableIsland } from '../../../src/components/islands/ColumnsTableIsland'
import { RollTableIsland } from '../../../src/components/islands/RollTableIsland'
import { ELDRIDGE_COAST_MAP } from '../../../src/lib/builtAssets'
import type { PageModule } from '../../../src/reference/types'
import type { CollectedIslands } from '../../../src/runtime/Island'
import type { PageAssets, ReferenceDocument } from '../document'
import { renderDocument } from '../document'
import { islandParts } from '../islandParts'
import { astroPaths, fillPattern } from '../routePath'

const PAGES = join(import.meta.dir, '../../pages')

const ASSETS: PageAssets = {
  stylesheet: { href: '/assets/base.css', fonts: [] },
  built: { [ELDRIDGE_COAST_MAP]: '/assets/eldridge-coast-map.webp' },
}

/** One concrete page: its route without the trailing slash (`/` stays `/`). */
type BuiltPage = {
  route: string
  render: (assets?: PageAssets) => string
  /** The page's parts as `Page.astro` receives them, islands collected. */
  document: () => ReferenceDocument
}

export type Shell = {
  /** The shell's path under `astro/pages/`: `[schemaId]/index.astro`. */
  file: string
  // biome-ignore lint/suspicious/noExplicitAny: a heterogeneous list of modules erases their params and props.
  module: PageModule<any, any>
  pages: BuiltPage[]
}

/** The islands Astro server-renders from their props (`hydrate`), as `Islands.astro` names them. */
const HYDRATED: Record<string, ComponentType<Record<string, unknown>>> = {
  RollTableIsland: RollTableIsland as ComponentType<Record<string, unknown>>,
  ColumnsTableIsland: ColumnsTableIsland as ComponentType<Record<string, unknown>>,
}

/**
 * Each island where its marker stands, as `Islands.astro` draws it: Astro's
 * element around the island's own server render (`hydrate`) or its stand-in.
 * Its props stay off the markup here (Astro escapes them into an attribute);
 * a test reads them from `BuiltPage.document`.
 */
function withIslands(body: string, islands: CollectedIslands): string {
  return islandParts(body, islands)
    .map((part) => {
      if ('html' in part) return part.html
      const { name, props, hydrate, standIn } = part.island
      const Component = HYDRATED[name]
      if (hydrate && !Component) throw new Error(`[test] no server render for ${name}`)
      const inner = Component ? renderToString(<Component {...props} />) : standIn
      return `<astro-island data-island="${name}">${inner}</astro-island>`
    })
    .join('')
}

/** A document as `Page.astro` stitches it: Astro adds the doctype and its module script. */
export function documentHtml({ head, body, islands }: ReferenceDocument): string {
  return `<!doctype html><html lang="en"><head>${head}<script type="module" src="/assets/islands.js"></script></head><body>${withIslands(body, islands)}</body></html>`
}

const MODULE_IMPORT = /import \{ (\w+) as module \} from '([^']+)'/

async function read(): Promise<Shell[]> {
  const shells: Shell[] = []
  for (const file of [...new Bun.Glob('**/*.astro').scanSync(PAGES)].sort()) {
    const found = MODULE_IMPORT.exec(readFileSync(join(PAGES, file), 'utf-8'))
    if (!found) continue
    const [, name = '', from = ''] = found
    const imported = (await import(join(PAGES, dirname(file), from))) as Record<string, unknown>
    const module = imported[name] as Shell['module']
    const pages = astroPaths(module.getStaticPaths).map(({ params, props }) => ({
      route: fillPattern(module.pattern, params),
      render: (assets = ASSETS) => documentHtml(renderDocument(module, params, props.page, assets)),
      document: () => renderDocument(module, params, props.page, ASSETS),
    }))
    shells.push({ file, module, pages })
  }
  return shells
}

/** Every page shell but the app's (`build/index.astro`, which wraps no module). */
export const shells = await read()

function builtPage(route: string): BuiltPage {
  for (const shell of shells) {
    const page = shell.pages.find((p) => p.route === route)
    if (page) return page
  }
  throw new Error(`no page shell emits ${route}`)
}

/** The page at a route (no trailing slash), rendered with the stand-in assets. */
export function renderRoute(route: string): string {
  return builtPage(route).render()
}

/** The islands the page at a route collects, with their props. */
export function routeIslands(route: string): CollectedIslands {
  return builtPage(route).document().islands
}
