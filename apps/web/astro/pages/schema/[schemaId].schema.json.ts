import type { APIRoute } from 'astro'
import { schemaDefinitionJsonEndpoint as module } from '../../../src/reference/endpoints/schemaDefinitionJson'
import { endpointPaths, renderEndpoint } from '../../lib/reference'

export const getStaticPaths = () => endpointPaths(module)
export const GET: APIRoute = ({ params, props }) => renderEndpoint(module, params, props.page)
