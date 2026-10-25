import type { APIRoute } from 'astro'
import { searchIndexJsonEndpoint as module } from '../../src/reference/endpoints/searchIndexJson'
import { renderEndpoint } from '../lib/endpoint'

export const GET: APIRoute = () => renderEndpoint(module, {}, undefined)
