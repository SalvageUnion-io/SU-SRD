import type { APIRoute } from 'astro'
import { llmsTxtEndpoint as module } from '../../src/reference/endpoints/llmsTxt'
import { renderEndpoint } from '../lib/endpoint'

export const GET: APIRoute = () => renderEndpoint(module, {}, undefined)
