/**
 * document — assembles one complete `<html>` document string.
 *
 * `BaseLayout` owns every tag it can know statically; this module owns the two
 * things only the build knows: the hashed asset URLs from the Vite manifest,
 * and the single `data-island-props` JSON payload collected during the render.
 * Both are injected into the rendered string rather than threaded through the
 * React tree, so pages and layouts stay ignorant of the build.
 */

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BaseLayout } from '../src/layouts/BaseLayout'
import type { CollectedIslandProps } from '../src/runtime/Island'
import { beginIslandCollection, endIslandCollection } from '../src/runtime/Island'
import type { DocumentMeta, DocumentShell } from './types'

/** Hashed URLs of the built client assets, read from `dist/.vite/manifest.json`. */
export type BuildAssets = {
  /** Module scripts to load, in order (normally just the islands entry). */
  scripts: string[]
  /** Stylesheets to link, in order. */
  styles: string[]
}

/**
 * `</script>` inside a JSON payload would close the host script element. The
 * browser's JSON parser treats `<` as `<`, so this is lossless.
 */
function escapeJsonForScript(json: string): string {
  return json.replace(/</g, '\\u003c')
}

function assetTags(assets: BuildAssets): string {
  const styles = assets.styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('')
  const scripts = assets.scripts
    .map((src) => `<script type="module" src="${src}"></script>`)
    .join('')
  return styles + scripts
}

function islandPropsTag(props: CollectedIslandProps): string {
  if (Object.keys(props).length === 0) return ''
  const json = escapeJsonForScript(JSON.stringify(props))
  return `<script type="application/json" data-island-props>${json}</script>`
}

export type RenderDocumentInput = {
  meta: DocumentMeta
  /** Pathname WITH a trailing slash. */
  pathname: string
  children: ReactNode
  assets: BuildAssets
  /** `'bare'` renders `children` AS the document; see `DocumentShell`. */
  shell?: DocumentShell
}

export function renderDocument({
  meta,
  pathname,
  children,
  assets,
  shell = 'base',
}: RenderDocumentInput): string {
  beginIslandCollection()
  let markup: string
  let islandProps: CollectedIslandProps
  try {
    // A bare page renders its own `<html>`, so it is passed through untouched.
    // The asset + island-props injection below is string surgery on `</head>`
    // and `</body>`, which both shells produce, so it works either way.
    markup = renderToStaticMarkup(
      shell === 'bare' ? (
        children
      ) : (
        <BaseLayout meta={meta} pathname={pathname}>
          {children}
        </BaseLayout>
      )
    )
  } finally {
    islandProps = endIslandCollection()
  }

  const headIndex = markup.indexOf('</head>')
  if (headIndex === -1) throw new Error('rendered document has no </head>')
  const withAssets = markup.slice(0, headIndex) + assetTags(assets) + markup.slice(headIndex)

  const bodyIndex = withAssets.lastIndexOf('</body>')
  if (bodyIndex === -1) throw new Error('rendered document has no </body>')
  const withProps =
    withAssets.slice(0, bodyIndex) + islandPropsTag(islandProps) + withAssets.slice(bodyIndex)

  return `<!doctype html>${withProps}`
}
