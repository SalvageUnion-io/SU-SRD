/** Where the Worker answers for the rooms; `astro/build/devRooms.ts` proxies it in dev. */
export const ROOMS_PATH = '/__rooms'

/** `GET`: each room kind opens and migrates, or the answer is a 503. */
export const ROOMS_HEALTH_PATH = `${ROOMS_PATH}/health`

/** `POST`: one Games call by its name (`../worker/gameCalls.ts`). */
export const ROOMS_CALL_PATH = `${ROOMS_PATH}/call`

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

/** The signed-in player's account room socket (`protocol.ts`): whoever the session cookie signs in. */
export function accountSocketPath(): string {
  return `${ROOMS_PATH}/account/socket`
}

/**
 * The signed-in player's account, answered by the Worker from their session
 * (`worker/accountRoutes.ts`): who they are, their profile, their export and
 * their feedback; an admin's metrics; and the build floor, for anyone.
 */
export const ACCOUNT_PATHS = {
  /** `GET`: `{ _id, discordId, displayName, avatarUrl, email }`, or `null` signed out. */
  me: `${ROOMS_PATH}/account/me`,
  /** `POST { displayName?, avatarUrl? }`: the name and avatar overrides. */
  profile: `${ROOMS_PATH}/account/profile`,
  /** `GET`: everything the player owns, for download. */
  export: `${ROOMS_PATH}/account/export`,
  /** `POST { kind, text, page? }`: "Suggest or report". */
  feedback: `${ROOMS_PATH}/account/feedback`,
  /** `GET`: the usage metrics for an admin, `null` for anyone else. */
  metrics: `${ROOMS_PATH}/admin/metrics`,
  /** `POST`: take a fresh metrics snapshot now. Admins only. */
  refreshMetrics: `${ROOMS_PATH}/admin/metrics/refresh`,
  /** `POST`: back up every room into R2 now, as the nightly run does. Admins only. */
  backup: `${ROOMS_PATH}/admin/backup`,
  /** `POST { day, kind, name }`: load that day's backup into one room. Admins only. */
  restore: `${ROOMS_PATH}/admin/restore`,
  /** `GET`: the oldest client build this backend accepts. */
  floor: `${ROOMS_PATH}/floor`,
} as const
