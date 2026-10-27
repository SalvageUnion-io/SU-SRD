/**
 * document — renders one page module into the head and body `Page.astro`
 * emits.
 *
 * `BaseLayout` owns every tag it can know statically; this module adds what
 * only the build knows: the base stylesheet. The
 * islands collected during the render go back to `Page.astro`, which renders
 * each at its marker, and the scripts are Astro's. It imports no build
 * asset, so a unit test renders a page by handing it its own.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { SITE_URL } from '../../src/lib/constants'
import { BaseLayout } from '../../src/reference/layouts/BaseLayout'
import type { BuiltAssets, PageModule } from '../../src/reference/types'
import type { CollectedIslands } from '../../src/runtime/Island'
import { beginIslandCollection, endIslandCollection } from '../../src/runtime/Island'
import type { AstroParams } from './routePath'
import { fillPattern, withTrailingSlash } from './routePath'

/**
 * The pieces of one rendered document `Page.astro` stitches back together,
 * and whether its head preloads the tagline's hand (`Fonts.astro`).
 */
export type ReferenceDocument = {
  head: string
  body: string
  islands: CollectedIslands
  scriptFont: boolean
}

/** The base stylesheet (`virtual:base-stylesheet`). */
type BaseStylesheet = { href: string }

/** What a page links and addresses: the stylesheet, and the files under `src/assets/`. */
export type PageAssets = { stylesheet: BaseStylesheet; built: BuiltAssets }

/** Both shells open `<html lang="en">` and a bare `<body>`, as the layout does. */
const DOCUMENT = /^<html lang="en"><head>([\s\S]*)<\/head><body>([\s\S]*)<\/body><\/html>$/

export function renderDocument<Params extends Record<string, string>, Props>(
  module: PageModule<Params, Props>,
  astroParams: AstroParams,
  props: Props,
  assets: PageAssets
): ReferenceDocument {
  const params = astroParams as Params
  const pathname = withTrailingSlash(fillPattern(module.pattern, params))
  const result = module.page({
    params,
    props,
    url: new URL(pathname, SITE_URL),
    pathname,
    builtAssets: assets.built,
  })
  beginIslandCollection()
  let markup: string
  let islands: CollectedIslands
  try {
    markup = renderToStaticMarkup(
      result.shell === 'bare' ? (
        result.children
      ) : (
        <BaseLayout meta={result.meta} pathname={pathname} foot={result.foot}>
          {result.children}
        </BaseLayout>
      )
    )
  } finally {
    islands = endIslandCollection()
  }
  const parts = DOCUMENT.exec(markup)
  if (!parts) throw new Error(`[build] ${pathname} did not render one <html> document`)
  const [, head = '', body = ''] = parts
  return {
    head: `${head}<link rel="stylesheet" href="${assets.stylesheet.href}">`,
    body,
    islands,
    scriptFont: Boolean(result.meta.preloadScriptFont),
  }
}
