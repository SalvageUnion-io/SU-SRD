import type { APIRoute } from 'astro'
import { apiV1DataEndpoint as module } from '../../../../src/reference/endpoints/apiV1'
import { endpointPaths, renderEndpoint } from '../../../lib/reference'

export const getStaticPaths = () => endpointPaths(module)
export const GET: APIRoute = ({ params, props }) => renderEndpoint(module, params, props.page)
