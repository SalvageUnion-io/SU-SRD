/**
 * `POST /__rooms/call`: one Games call by its Convex name, as the session
 * cookie's player (`./shared/gameCalls.ts` has the calls and their rules).
 */

import type { Identity } from './auth/index'
import { identityOf } from './auth/index'
import type { D1Like } from './auth/store'
import type { GameRoomStub } from './rooms'
import { rooms } from './rooms'
import type { SharedDb } from './shared/db'
import type { BotRelayEnv, CallDeps } from './shared/gameCalls'
import { gameCall } from './shared/gameCalls'

type AccountStub = ReturnType<CallDeps['account']>

/** `POST /__rooms/call`: one call, as the session cookie's player. */
export async function serveGameCall(
  request: Request,
  env: BotRelayEnv & { SHARED: D1Like; ADMIN_DISCORD_IDS?: string },
  identify: (request: Request, env: { SHARED: D1Like }) => Promise<Identity | null> = identityOf
): Promise<Response> {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' }
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const said = (await request.json().catch(() => null)) as { name?: unknown; args?: unknown } | null
  if (typeof said?.name !== 'string') return new Response(null, { status: 400 })
  const who = await identify(request, env)
  const deps: CallDeps = {
    db: env.SHARED as unknown as SharedDb,
    game: (gameId) => rooms().GameRoom.getByName(gameId) as unknown as GameRoomStub,
    account: (discordId) => rooms().AccountRoom.getByName(discordId) as unknown as AccountStub,
    bot: env,
    newId: () => crypto.randomUUID(),
    fetch,
  }
  try {
    const answer = await gameCall(said.name, said.args, who, deps)
    if (answer === null) return new Response(null, { status: 404 })
    return new Response(JSON.stringify(answer), { headers })
  } catch (error) {
    console.error('a Game call failed', said.name, error)
    return new Response(JSON.stringify({ error: 'call_failed' }), { status: 500, headers })
  }
}
