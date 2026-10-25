/** Where the Worker answers for the rooms; `astro/build/devRooms.ts` proxies it in dev. */
export const ROOMS_PATH = '/__rooms'

/** `GET`: each room kind opens and migrates, or the answer is a 503. */
export const ROOMS_HEALTH_PATH = `${ROOMS_PATH}/health`

/** A Game's socket: `?seat=1` counts its member as here, else they watch. */
export function gameSocketPath(gameId: string): string {
  return `${ROOMS_PATH}/games/${encodeURIComponent(gameId)}/socket`
}

const GAME_SOCKET = new RegExp(`^${ROOMS_PATH}/games/([^/]+)/socket$`)

/** The Game a socket path opens, or null when the path is not one. */
export function gameOfSocketPath(pathname: string): string | null {
  const id = GAME_SOCKET.exec(pathname)?.[1]
  return id === undefined ? null : decodeURIComponent(id)
}
