import { httpRouter } from 'convex/server'
import { BOT_PATH_PREFIX } from 'game-domain/botWire'
import { botRoute } from './botHttp'

/**
 * HTTP routes for the deployment. Sign-in is the site Worker's
 * (`src/worker/auth/`), so none of its routes are here.
 *
 * `/bot/*` is the Discord bot's door (ADR-030). It exists because the
 * bot holds no Convex auth token and so cannot call a normal query; see
 * `botHttp.ts` for what its bearer credential does and does not authorize.
 */
const http = httpRouter()

http.route({ pathPrefix: BOT_PATH_PREFIX, method: 'POST', handler: botRoute })

export default http
