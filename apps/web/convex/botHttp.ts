import type { BotOpName } from 'cantina-domain/botWire'
import { BOT_OP_NAMES, BOT_PATH_PREFIX, bearerToken, secretsMatch } from 'cantina-domain/botWire'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'

/**
 * The bot's HTTP door (ADR-030).
 *
 * The Discord bot runs as a worker with no Convex auth token, so it cannot
 * reach a normal query. It posts here instead, presenting a bearer
 * credential, and this module forwards to the `internal.botClient.*` functions
 * — which are unreachable from any client, so this is the only way in.
 *
 * ## What the credential does and does not buy
 *
 * It authenticates the **bot**, not the **actor**. Every forwarded call carries
 * a `discordId` that `botClient` resolves against a linked account and a real
 * membership before it returns anything. So the credential lets its holder ask
 * "what may this Discord user see?" — never "show me everything".
 *
 * Be honest about the residual: the bot *asserts* the Discord id, because a
 * gateway event carries no signature to check it against. Whoever holds this
 * secret can therefore claim to be any linked player. That is bounded (no
 * inventing memberships, no unlinked accounts, no shelves but their own, never
 * `encounterNpcs`) but it is real, and the endgame is to remove it: point
 * Discord's interactions endpoint at a Convex HTTP action and verify Discord's
 * Ed25519 signature, at which point the id is attested rather than asserted.
 * See `docs/ARCHITECTURE.md#bot-game-client`.
 *
 * `CANTINA_BOT_SECRET` unset disables the whole surface — a deployment that has
 * not opted in cannot be talked to by a bot, rather than being talked to by
 * anyone.
 */

/** The read operations the bot may invoke, mapped to their internal query. */
const QUERIES = {
  me: internal.botClient.me,
  games: internal.botClient.games,
  sheet: internal.botClient.sheet,
  mine: internal.botClient.mine,
} as const

/** The write operations (`/su bind`, `/su unbind`), mapped to their internal mutation. */
const MUTATIONS = {
  bindChannel: internal.botClient.bindChannel,
  unbindChannel: internal.botClient.unbindChannel,
} as const

/**
 * Whether an op writes, and so runs as a mutation rather than a query. Every
 * other op indexes `QUERIES`, so an op added to `BOT_OP_NAMES` with no function
 * in either map fails to compile where `botRoute` looks it up.
 *
 * Not exported, like the maps: an exported value typed by `internal` makes the
 * generated `api` type reference itself through this module.
 */
function isMutationOp(op: BotOpName): op is keyof typeof MUTATIONS {
  return op in MUTATIONS
}

/**
 * Every operation name, for tests and for the 404 body: the bot's own list
 * (`cantina-domain/botWire`), which `QUERIES` and `MUTATIONS` together must
 * cover exactly. Typed
 * `readonly string[]` so a path segment can be looked up in it.
 */
export const BOT_OPS: readonly string[] = BOT_OP_NAMES

/** The op named by a `/bot/<op>` path, or null when the path names none. */
export function opFromPath(pathname: string): BotOpName | null {
  if (!pathname.startsWith(BOT_PATH_PREFIX)) return null
  const op = pathname.slice(BOT_PATH_PREFIX.length)
  return BOT_OPS.includes(op) ? (op as BotOpName) : null
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const botRoute = httpAction(async (ctx, request) => {
  const expected = process.env.CANTINA_BOT_SECRET
  // Unconfigured is 404, not 401: a deployment that has not opted in should be
  // indistinguishable from one where this route does not exist.
  if (expected === undefined || expected.length === 0) {
    return json({ error: 'not found' }, 404)
  }

  const presented = bearerToken(request.headers.get('Authorization'))
  if (presented === null || !secretsMatch(presented, expected)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const op = opFromPath(new URL(request.url).pathname)
  if (op === null) return json({ error: 'unknown operation' }, 404)

  let args: Record<string, unknown>
  try {
    args = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'malformed body' }, 400)
  }

  // `runQuery` / `runMutation` validate the args against each function's own
  // validators, so a malformed payload fails there rather than needing a second
  // copy of every argument shape here.
  try {
    const result = isMutationOp(op)
      ? await ctx.runMutation(MUTATIONS[op], args as never)
      : await ctx.runQuery(QUERIES[op], args as never)
    return json(result, 200)
  } catch (error) {
    // The message is passed through deliberately, and it is safe to: this
    // route is already behind the bot credential, so the only reader is the
    // bot, and the bot renders every non-200 as a flat "could not be reached"
    // rather than surfacing this text to anybody. What it buys is a real
    // argument-validation error in the logs instead of a bare 400.
    const message = error instanceof Error ? error.message : 'internal error'
    return json({ error: message }, 400)
  }
})
