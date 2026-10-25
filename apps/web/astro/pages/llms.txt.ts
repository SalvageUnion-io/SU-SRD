import type { APIRoute } from 'astro'
import { llmsTxtEndpoint as module } from '../../src/reference/endpoints/llmsTxt'
import { renderEndpoint } from '../lib/reference'

export const GET: APIRoute = () => renderEndpoint(module, {}, undefined)
