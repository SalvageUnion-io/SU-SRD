/**
 * endpoint — the seam between Astro and the reference site's endpoint modules
 * (`src/reference/endpoints/**`): text files written verbatim, never a page.
 * It imports no build asset, so a unit test can run a route's `GET` itself.
 */

import { SITE_URL } from '../../src/lib/constants'
import type { EndpointModule } from '../../src/reference/types'
import type { AstroParams } from './routePath'
import { astroPaths, fillPattern } from './routePath'

export function endpointPaths<Params, Props>(module: EndpointModule<Params, Props>) {
  return astroPaths(module.getStaticPaths)
}

/** An endpoint module's body for one path. */
export function renderEndpoint<Params extends Record<string, string>, Props>(
  module: EndpointModule<Params, Props>,
  astroParams: AstroParams,
  props: Props
): Response {
  const params = astroParams as Params
  // No trailing slash: an endpoint is a file, not a directory index.
  const pathname = `/${fillPattern(module.pattern, params)}`
  const body = module.body({
    params,
    props,
    url: new URL(pathname, SITE_URL),
    pathname,
    // Endpoints are text outputs: nothing to point at an emitted image.
    builtAssets: {},
  })
  return new Response(body, { headers: { 'Content-Type': module.contentType } })
}
