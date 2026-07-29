import { httpRouter } from 'convex/server'

import { auth } from './auth'
import { BOT_PATH_PREFIX, botRoute } from './botHttp'

/**
 * HTTP routes for the deployment. `auth.addHttpRoutes` mounts the OAuth
 * callback endpoints that Discord redirects back to — without this, sign-in
 * starts but can never complete.
 *
 * `/bot/*` is the Discord bot's door (ADR-030 Phase 6). It exists because the
 * bot holds no Convex auth token and so cannot call a normal query; see
 * `botHttp.ts` for what its bearer credential does and does not authorize.
 */
const http = httpRouter()

auth.addHttpRoutes(http)

http.route({ pathPrefix: BOT_PATH_PREFIX, method: 'POST', handler: botRoute })

export default http
