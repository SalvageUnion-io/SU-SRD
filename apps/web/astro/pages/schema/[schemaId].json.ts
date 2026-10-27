import type { APIRoute } from 'astro'
import { schemaJsonEndpoint as module } from '../../../src/reference/endpoints/schemaJson'
import { endpointPaths, renderEndpoint } from '../../lib/endpoint'

export const getStaticPaths = () => endpointPaths(module)
export const GET: APIRoute = ({ params, props }) => renderEndpoint(module, params, props.page)
