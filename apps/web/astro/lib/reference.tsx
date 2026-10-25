/**
 * reference — the seam between Astro and the reference site's page modules.
 *
 * A page module (`src/reference/pages/**`) already speaks Astro's grammar:
 * a `pattern`, a `getStaticPaths` and a render. Astro owns the routing, the
 * build and the asset graph; the module keeps rendering its React tree with
 * `renderToStaticMarkup`, inside the island collection window, as `ssg/` did.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { SITE_URL } from '../../src/lib/constants'
import { escapeJsonForScript } from '../../src/lib/escapeJsonForScript'
import { BaseLayout } from '../../src/reference/layouts/BaseLayout'
import { beginIslandCollection, endIslandCollection } from '../../src/runtime/Island'
import { fillPattern, withTrailingSlash } from '../../ssg/render'
import type { EndpointModule, PageModule, StaticPath } from '../../ssg/types'
import { BUILT_ASSETS, FONT_PRELOADS } from './assets'

/** The pieces of one rendered document the Astro layout stitches back together. */
export type ReferenceDocument = { head: string; body: string }

/**
 * A route's params as Astro hands them back: the ones the module's own
 * `getStaticPaths` produced, so the seam names them as the module's.
 */
type AstroParams = Record<string, string | undefined>

/** Astro's static path for a module path: the module's props ride under `props.page`. */
type AstroPath<Params, Props> = { params: Params; props: { page: Props } }

function pathsOf<Params, Props>(
  getStaticPaths: (() => StaticPath<Params, Props>[]) | undefined
): AstroPath<Params, Props>[] {
  const paths = getStaticPaths
    ? getStaticPaths()
    : [{ params: {} as Params, props: undefined as Props }]
  return paths.map(({ params, props }) => ({ params, props: { page: props } }))
}

export function pagePaths<Params, Props>(module: PageModule<Params, Props>) {
  return pathsOf(module.getStaticPaths)
}

export function endpointPaths<Params, Props>(module: EndpointModule<Params, Props>) {
  return pathsOf(module.getStaticPaths)
}

/** Both shells open `<html lang="en">` and a bare `<body>`, as the layout does. */
const DOCUMENT = /^<html lang="en"><head>([\s\S]*)<\/head><body>([\s\S]*)<\/body><\/html>$/

/** Renders one page module into the parts `ReferenceLayout.astro` emits. */
export function renderReference<Params extends Record<string, string>, Props>(
  module: PageModule<Params, Props>,
  astroParams: AstroParams,
  props: Props
): ReferenceDocument {
  const params = astroParams as Params
  const pathname = withTrailingSlash(fillPattern(module.pattern, params))
  const result = module.page({
    params,
    props,
    url: new URL(pathname, SITE_URL),
    pathname,
    builtAssets: BUILT_ASSETS,
  })
  // `crossorigin` even same-origin: fonts load in CORS mode (`ssg/document.tsx`).
  const fonts = result.meta.preloadScriptFont
    ? [...FONT_PRELOADS.every, FONT_PRELOADS.script]
    : FONT_PRELOADS.every
  const preloads = fonts
    .map((href) => `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`)
    .join('')
  beginIslandCollection()
  let markup: string
  let islandProps: Record<string, unknown>
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
  if (!parts) throw new Error(`[astro] ${pathname} did not render one <html> document`)
  const [, head = '', body = ''] = parts
  const propsTag =
    Object.keys(islandProps).length === 0
      ? ''
      : `<script type="application/json" data-island-props>${escapeJsonForScript(JSON.stringify(islandProps))}</script>`
  return { head: head + preloads, body: body + propsTag }
}

/** An endpoint module's body for one path. */
export function renderEndpoint<Params extends Record<string, string>, Props>(
  module: EndpointModule<Params, Props>,
  astroParams: AstroParams,
  props: Props
): Response {
  const params = astroParams as Params
  const pathname = `/${fillPattern(module.pattern, params)}`
  const body = module.body({
    params,
    props,
    url: new URL(pathname, SITE_URL),
    pathname,
    builtAssets: {},
  })
  return new Response(body, { headers: { 'Content-Type': module.contentType } })
}
