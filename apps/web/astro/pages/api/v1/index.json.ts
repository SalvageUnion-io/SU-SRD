import type { APIRoute } from 'astro'
import { apiV1IndexEndpoint as module } from '../../../../src/reference/endpoints/apiV1'
import { renderEndpoint } from '../../../lib/reference'

export const GET: APIRoute = () => renderEndpoint(module, {}, undefined)
