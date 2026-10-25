/**
 * The pages the build emits from `astro/pages/**.astro`, rendered without a
 * build: each shell names the page module it wraps (`import { x as module }`),
 * and this renders that module through `../document`, as the shell does, with
 * stand-in assets.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ELDRIDGE_COAST_MAP } from '../../../src/lib/builtAssets'
import type { PageModule } from '../../../src/reference/types'
import type { PageAssets, ReferenceDocument } from '../document'
import { renderDocument } from '../document'
import { astroPaths, fillPattern } from '../routePath'

const PAGES = join(import.meta.dir, '../../pages')

const ASSETS: PageAssets = {
  stylesheet: { href: '/assets/base.css', fonts: [] },
  built: { [ELDRIDGE_COAST_MAP]: '/assets/eldridge-coast-map.webp' },
}

/** One concrete page: its route without the trailing slash (`/` stays `/`). */
type BuiltPage = { route: string; render: (assets?: PageAssets) => string }

export type Shell = {
  /** The shell's path under `astro/pages/`: `[schemaId]/index.astro`. */
  file: string
  // biome-ignore lint/suspicious/noExplicitAny: a heterogeneous list of modules erases their params and props.
  module: PageModule<any, any>
  pages: BuiltPage[]
}

/** A document as `Page.astro` stitches it: Astro adds the doctype and its module script. */
export function documentHtml({ head, body }: ReferenceDocument): string {
  return `<!doctype html><html lang="en"><head>${head}<script type="module" src="/assets/islands.js"></script></head><body>${body}</body></html>`
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
    }))
    shells.push({ file, module, pages })
  }
  return shells
}

/** Every page shell but the app's (`build/index.astro`, which wraps no module). */
export const shells = await read()

/** The page at a route (no trailing slash), rendered with the stand-in assets. */
export function renderRoute(route: string): string {
  for (const shell of shells) {
    const page = shell.pages.find((p) => p.route === route)
    if (page) return page.render()
  }
  throw new Error(`no page shell emits ${route}`)
}
