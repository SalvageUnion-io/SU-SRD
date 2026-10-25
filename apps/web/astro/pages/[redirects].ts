/** `_redirects`: Astro skips a page file whose name starts with `_`, so its name is a param. */
import type { APIRoute } from 'astro'
import { redirectsEndpoint as module } from '../../src/reference/endpoints/redirects'
import { renderEndpoint } from '../lib/reference'

export const getStaticPaths = () => [{ params: { redirects: module.pattern } }]
export const GET: APIRoute = () => renderEndpoint(module, {}, undefined)
