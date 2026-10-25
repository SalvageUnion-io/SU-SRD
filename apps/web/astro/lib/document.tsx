/**
 * document — renders one page module into the head and body `Page.astro`
 * emits.
 *
 * `BaseLayout` owns every tag it can know statically; this module adds the
 * two things only the build knows: the base stylesheet with the faces it
 * preloads, and the single `data-island-props` JSON payload collected during
 * the render. The scripts are Astro's (`Page.astro`). It imports no build
 * asset, so a unit test renders a page by handing it its own.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { SITE_URL } from '../../src/lib/constants'
import { escapeJsonForScript } from '../../src/lib/escapeJsonForScript'
import { BaseLayout } from '../../src/reference/layouts/BaseLayout'
import type { BuiltAssets, PageModule } from '../../src/reference/types'
import type { CollectedIslandProps } from '../../src/runtime/Island'
import { beginIslandCollection, endIslandCollection } from '../../src/runtime/Island'
import type { AstroParams } from './routePath'
import { fillPattern, withTrailingSlash } from './routePath'

/** The pieces of one rendered document `Page.astro` stitches back together. */
export type ReferenceDocument = { head: string; body: string }

/** The base stylesheet and the webfonts it preloads (`virtual:base-stylesheet`). */
type BaseStylesheet = {
  href: string
  fonts: readonly string[]
  /** The tagline's hand, preloaded only by a page whose meta asks for it. */
  scriptFont?: string
}

/** What a page links and addresses: the stylesheet, and the files under `src/assets/`. */
export type PageAssets = { stylesheet: BaseStylesheet; built: BuiltAssets }

/** Both shells open `<html lang="en">` and a bare `<body>`, as the layout does. */
const DOCUMENT = /^<html lang="en"><head>([\s\S]*)<\/head><body>([\s\S]*)<\/body><\/html>$/

function headTags({ href, fonts, scriptFont }: BaseStylesheet, preloadScriptFont: boolean) {
  // `crossorigin` even same-origin: fonts are fetched in CORS mode, and a
  // preload without it is not reused, so the font downloads twice.
  const faces = preloadScriptFont && scriptFont ? [...fonts, scriptFont] : fonts
  const preloads = faces
    .map((font) => `<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin>`)
    .join('')
  return `${preloads}<link rel="stylesheet" href="${href}">`
}

function islandPropsTag(props: CollectedIslandProps): string {
  if (Object.keys(props).length === 0) return ''
  const json = escapeJsonForScript(JSON.stringify(props))
  return `<script type="application/json" data-island-props>${json}</script>`
}

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
  let islandProps: CollectedIslandProps
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
    islandProps = endIslandCollection()
  }
  const parts = DOCUMENT.exec(markup)
  if (!parts) throw new Error(`[build] ${pathname} did not render one <html> document`)
  const [, head = '', body = ''] = parts
  return {
    head: head + headTags(assets.stylesheet, Boolean(result.meta.preloadScriptFont)),
    body: body + islandPropsTag(islandProps),
  }
}
