import { internal } from './_generated/api'
import { httpAction } from './_generated/server'

/**
 * The bot's HTTP door (ADR-030 Phase 6).
 *
 * The Discord bot runs as a worker with no Convex auth token, so it cannot
 * reach a normal query or mutation. It posts here instead, presenting a bearer
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
 * See `docs/architecture/discord-bot-game-client.md` §3.
 *
 * `ITUN_BOT_SECRET` unset disables the whole surface — a deployment that has
 * not opted in cannot be talked to by a bot, rather than being talked to by
 * anyone.
 */

/** Operations the bot may invoke, mapped to their internal function. */
const QUERIES = {
  me: internal.botClient.me,
  games: internal.botClient.games,
  shelf: internal.botClient.shelf,
  channel: internal.botClient.channel,
  crew: internal.botClient.crew,
  sheet: internal.botClient.sheet,
} as const

const MUTATIONS = {
  bind: internal.botClient.bind,
  unbind: internal.botClient.unbind,
  recordRoll: internal.botClient.recordRoll,
} as const

export const BOT_PATH_PREFIX = '/bot/'

export type BotOp = keyof typeof QUERIES | keyof typeof MUTATIONS

/** Every operation name, for tests and for the 404 body. */
export const BOT_OPS: readonly string[] = [...Object.keys(QUERIES), ...Object.keys(MUTATIONS)]

/**
 * Compare two secrets without leaking their common prefix through timing.
 *
 * Length is compared first and short-circuits, which does leak the secret's
 * length — that is accepted: a length oracle does not meaningfully narrow a
 * random secret, whereas a byte-by-byte early exit would.
 */
export function secretsMatch(presented: string, expected: string): boolean {
  if (presented.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < presented.length; i += 1) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Pull the bearer token out of an Authorization header.
 * Returns null for a missing, malformed, or non-bearer header.
 */
export function bearerToken(header: string | null): string | null {
  if (header === null) return null
  const match = /^Bearer (.+)$/.exec(header.trim())
  return match?.[1] ?? null
}

/** The op named by a `/bot/<op>` path, or null when the path names none. */
export function opFromPath(pathname: string): BotOp | null {
  if (!pathname.startsWith(BOT_PATH_PREFIX)) return null
  const op = pathname.slice(BOT_PATH_PREFIX.length)
  return BOT_OPS.includes(op) ? (op as BotOp) : null
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const botRoute = httpAction(async (ctx, request) => {
  const expected = process.env.ITUN_BOT_SECRET
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

  // `runQuery`/`runMutation` validate the args against each function's own
  // validators, so a malformed payload fails there rather than needing a
  // second copy of every argument shape here.
  try {
    const result =
      op in QUERIES
        ? await ctx.runQuery(QUERIES[op as keyof typeof QUERIES], args as never)
        : await ctx.runMutation(MUTATIONS[op as keyof typeof MUTATIONS], args as never)
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
