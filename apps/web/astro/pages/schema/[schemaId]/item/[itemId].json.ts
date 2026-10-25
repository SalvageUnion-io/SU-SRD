import type { APIRoute } from 'astro'
import { itemJsonEndpoint as module } from '../../../../../src/reference/endpoints/itemJson'
import { endpointPaths, renderEndpoint } from '../../../../lib/reference'

export const getStaticPaths = () => endpointPaths(module)
export const GET: APIRoute = ({ params, props }) => renderEndpoint(module, params, props.page)
