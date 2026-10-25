/**
 * reference — the seam between Astro and the reference site's page modules.
 *
 * A page module (`src/reference/pages/**`) already speaks Astro's grammar:
 * a `pattern`, a `getStaticPaths` and a render. Astro owns the routing, the
 * build and the asset graph; the module renders its React tree through
 * `./document`, with the assets this build emitted.
 */

import type { PageModule } from '../../src/reference/types'
import { BASE_STYLESHEET, BUILT_ASSETS } from './assets'
import type { ReferenceDocument } from './document'
import { renderDocument } from './document'
import type { AstroParams } from './routePath'
import { astroPaths } from './routePath'

export type { ReferenceDocument }

export function pagePaths<Params, Props>(module: PageModule<Params, Props>) {
  return astroPaths(module.getStaticPaths)
}

/** Renders one page module into the parts `Page.astro` emits. */
export function renderReference<Params extends Record<string, string>, Props>(
  module: PageModule<Params, Props>,
  astroParams: AstroParams,
  props: Props
): ReferenceDocument {
  return renderDocument(module, astroParams, props, {
    stylesheet: BASE_STYLESHEET,
    built: BUILT_ASSETS,
  })
}
