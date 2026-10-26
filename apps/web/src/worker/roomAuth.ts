/**
 * Who may open a Game's room: the one place the Worker decides it (ADR-064
 * §5). The session cookie's player, by Discord id, when the Game room counts
 * them a member (`roomMemberOf`). Until Convex goes, a caller with no such
 * cookie may still send their Convex session token as the second
 * Sec-WebSocket-Protocol entry: it must answer `games:get` for the Game, and
 * the member is the token's user.
 */

import { ROOM_PROTOCOL } from '../rooms/presence'

type Fetch = (input: string, init: RequestInit) => Promise<Response>

/** The credential a socket request carries after `ROOM_PROTOCOL`, or null. */
export function socketToken(request: Request): string | null {
  const [protocol, token] = (request.headers.get('sec-websocket-protocol') ?? '')
    .split(',')
    .map((p) => p.trim())
  return protocol === ROOM_PROTOCOL && token ? token : null
}

/** A Convex Auth token's user: its `sub` is `<userId>|<sessionId>`. Unverified; Convex verifies it. */
function tokenUser(token: string): string | null {
  try {
    const payload = token.split('.')[1] ?? ''
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const sub: unknown = JSON.parse(json).sub
    return typeof sub === 'string' ? (sub.split('|')[0] ?? null) : null
  } catch {
    return null
  }
}

/** The member's id when the request's cookie or token belongs to a member of `gameId`, else null. */
export async function roomMember(
  request: Request,
  env: { CONVEX_URL?: string },
  gameId: string,
  signedIn: (request: Request, gameId: string) => Promise<string | null> = async () => null,
  fetchImpl: Fetch = fetch
): Promise<string | null> {
  return (await signedIn(request, gameId)) ?? convexMember(request, env, gameId, fetchImpl)
}

/** The token's user when it belongs to a member of `gameId` on Convex, else null. */
async function convexMember(
  request: Request,
  env: { CONVEX_URL?: string },
  gameId: string,
  fetchImpl: Fetch
): Promise<string | null> {
  const token = socketToken(request)
  const userId = token === null ? null : tokenUser(token)
  if (token === null || userId === null || !env.CONVEX_URL) return null
  const res = await fetchImpl(`${env.CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'games:get', args: { gameId }, format: 'json' }),
  }).catch(() => null)
  if (res === null || !res.ok) return null
  const answer = (await res.json().catch(() => null)) as { status?: string; value?: unknown } | null
  return answer?.status === 'success' && answer.value != null ? userId : null
}
