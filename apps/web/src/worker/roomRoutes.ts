/**
 * What the Worker lets through to a room: its health, a member's socket to
 * their Game's room, and a signed-in player's socket to their account room.
 */

import type { Identity } from './auth/index'
import { identityOf } from './auth/index'
import type { D1Like } from './auth/store'
import type { GameRoomStub } from './rooms'
import { MEMBER_HEADER, rooms, SEAT_HEADER } from './rooms'
import { crossOrigin } from './shared/refusals'

export async function serveRoomsHealth(): Promise<Response> {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' }
  try {
    const [account, game] = await Promise.all([
      rooms().AccountRoom.getByName('health').health(),
      rooms().GameRoom.getByName('health').health(),
    ])
    return new Response(JSON.stringify({ account, game }), { headers })
  } catch (error) {
    console.error('rooms health failed', error)
    return new Response(JSON.stringify({ error: 'rooms_unavailable' }), { status: 503, headers })
  }
}

/**
 * Who may open a Game's room, the one place the Worker decides it (ADR-064
 * §5): the session cookie's player, by Discord id, when the Game room counts
 * them a member.
 */
async function signedInMember(
  request: Request,
  env: { SHARED: D1Like; ADMIN_DISCORD_IDS?: string },
  gameId: string,
  identify: Identify
): Promise<string | null> {
  const who = await identify(request, env)
  if (who === null) return null
  const room = rooms().GameRoom.getByName(gameId) as unknown as GameRoomStub
  const read = await room.act(who.discordId, 'read', undefined as never)
  return read.ok && read.value !== null ? who.discordId : null
}

/** Who signs the request in: `identityOf`, or a test's stand-in. */
type Identify = (request: Request, env: { SHARED: D1Like }) => Promise<Identity | null>

/**
 * A member's socket to their Game's room (`?seat=1`: they count as here);
 * anyone else, or another site's page, a 403.
 */
export async function serveGameSocket(
  request: Request,
  gameId: string,
  env: { SHARED: D1Like; ADMIN_DISCORD_IDS?: string },
  identify: Identify = identityOf
): Promise<Response> {
  if (request.headers.get('upgrade') !== 'websocket') return new Response(null, { status: 426 })
  if (crossOrigin(request)) return new Response(null, { status: 403 })
  const member = await signedInMember(request, env, gameId, identify)
  if (member === null) return new Response(null, { status: 403 })
  const headers = new Headers(request.headers)
  headers.set(MEMBER_HEADER, member)
  headers.set(SEAT_HEADER, new URL(request.url).searchParams.get('seat') === '1' ? '1' : '0')
  const room = rooms().GameRoom.getByName(gameId)
  // The stub's fetch speaks workerd's Request and Response, the same objects at run time.
  const forward = room.fetch.bind(room) as unknown as (req: Request) => Promise<Response>
  return forward(new Request(request, { headers }))
}

/** The signed-in player's socket to their own account room; signed out or another site's page, a 403. */
export async function serveAccountSocket(
  request: Request,
  env: { SHARED: D1Like; ADMIN_DISCORD_IDS?: string },
  identify: Identify = identityOf
): Promise<Response> {
  if (request.headers.get('upgrade') !== 'websocket') return new Response(null, { status: 426 })
  if (crossOrigin(request)) return new Response(null, { status: 403 })
  const who = await identify(request, env)
  if (who === null) return new Response(null, { status: 403 })
  const headers = new Headers(request.headers)
  headers.set(MEMBER_HEADER, who.discordId)
  const room = rooms().AccountRoom.getByName(who.discordId)
  // The stub's fetch speaks workerd's Request and Response, the same objects at run time.
  const forward = room.fetch.bind(room) as unknown as (req: Request) => Promise<Response>
  return forward(new Request(request, { headers }))
}
