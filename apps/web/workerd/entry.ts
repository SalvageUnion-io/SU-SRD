/**
 * The site Worker for the workerd tests: its rooms as the entry exports them
 * (`src/worker/index.ts`), and `fetch` the rooms' health and sockets alone
 * (`src/worker/routes.ts` routes the rest), since the adapter that serves the
 * Worker exists only in Astro's build.
 */

import { gameOfSocketPath, ROOMS_HEALTH_PATH } from '../src/rooms/routes'
import { serveAccountSocket, serveGameSocket, serveRoomsHealth } from '../src/worker/roomRoutes'

export { AccountRoom, GameRoom } from '../src/worker/rooms'

type Env = Parameters<typeof serveAccountSocket>[1]

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === ROOMS_HEALTH_PATH) return serveRoomsHealth()
    const gameId = gameOfSocketPath(pathname)
    if (gameId !== null) return serveGameSocket(request, gameId, env)
    return serveAccountSocket(request, env)
  },
}
