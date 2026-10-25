import type { APIRoute } from 'astro'
import { searchIndexJsonEndpoint as module } from '../../src/reference/endpoints/searchIndexJson'
import { renderEndpoint } from '../lib/reference'

export const GET: APIRoute = () => renderEndpoint(module, {}, undefined)
