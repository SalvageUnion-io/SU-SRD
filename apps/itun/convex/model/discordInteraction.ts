/**
 * A Discord interaction, verified and read by Convex itself (ADR-038 §3).
 *
 * Everywhere else the bot's bearer credential **asserts** who is asking, and
 * `botHttp.ts` is candid about what that costs. `/su invite` is the one
 * operation that cannot accept the assertion: an invite creates a membership,
 * and "a leaked bot secret cannot invent a membership" is the bound the rest of
 * the bot surface is built on. So for this operation the bot forwards Discord's
 * signed interaction untouched and Convex checks the signature against the
 * application's public key. Who ran the command, whom they named and which
 * Game they picked are then **attested by Discord**, not reported by the bot.
 *
 * This duplicates the bot's own verifier (`apps/discord-bot/src/http/verify.ts`)
 * rather than importing it, because Convex cannot import from another app. It
 * is the same algorithm over the same bytes, and small enough to read twice.
 *
 * Pure: no `_generated` imports, so it is unit-tested directly.
 */

const ENCODER = new TextEncoder()

/**
 * How old a signed interaction may be, in seconds. The bot forwards within
 * moments of receiving it; five minutes is slack for clocks, not for queues.
 * A replay inside the window finds the invite it already minted (the
 * interaction id is recorded on it), so the window bounds staleness, not harm.
 */
export const SIGNATURE_MAX_AGE_SECONDS = 300

/**
 * The slice of WebCrypto used here. `Ed25519` is not in the DOM lib's
 * algorithm union, so it is declared rather than cast at each call.
 */
type Ed25519Subtle = {
  importKey(
    format: 'raw',
    keyData: Uint8Array,
    algorithm: { name: 'Ed25519' },
    extractable: boolean,
    usages: readonly string[]
  ): Promise<CryptoKey>
  verify(
    algorithm: { name: 'Ed25519' },
    key: CryptoKey,
    signature: Uint8Array,
    data: Uint8Array
  ): Promise<boolean>
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/**
 * True when `rawBody` was signed by this Discord application at `timestamp`.
 *
 * Verifies the exact bytes received — never a re-serialised parse — and
 * returns false rather than throwing for every failure, because the caller's
 * answer is the same in all of them.
 */
export async function isSignedByDiscord(
  publicKeyHex: string,
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null
): Promise<boolean> {
  if (signatureHex === null || timestamp === null) return false
  const signature = hexToBytes(signatureHex)
  const keyBytes = hexToBytes(publicKeyHex)
  if (signature === null || keyBytes === null) return false

  const subtle = crypto.subtle as unknown as Ed25519Subtle
  try {
    const key = await subtle.importKey('raw', keyBytes, { name: 'Ed25519' }, false, ['verify'])
    return await subtle.verify(
      { name: 'Ed25519' },
      key,
      signature,
      ENCODER.encode(timestamp + rawBody)
    )
  } catch {
    // An unusable key or a malformed signature is an unverified request.
    return false
  }
}

/** True when Discord's `X-Signature-Timestamp` (unix seconds) is recent. */
export function isFresh(timestamp: string | null, nowMs: number): boolean {
  if (timestamp === null || !/^\d+$/.test(timestamp)) return false
  const ageSeconds = nowMs / 1000 - Number(timestamp)
  return Math.abs(ageSeconds) <= SIGNATURE_MAX_AGE_SECONDS
}

/** What a `/su invite` interaction says, read out of its signed body. */
export type InviteInteraction = {
  /** Discord's id for this interaction — the idempotency key. */
  interactionId: string
  /** Who ran the command. */
  inviterId: string
  channelId: string | null
  invitee: {
    id: string
    /** The unique handle (`sam`), shown to the Organizer as `@sam`. */
    username: string
    /** What Discord displays for them (`Sam`), used in prose. */
    displayName: string
    bot: boolean
  }
  role: 'player' | 'mediator'
  /** The `game` option's value (a Convex id from autocomplete), if given. */
  gameId: string | null
}

type RawOption = { name?: unknown; type?: unknown; value?: unknown; options?: unknown }
type RawUser = { id?: unknown; username?: unknown; global_name?: unknown; bot?: unknown }

const APPLICATION_COMMAND = 2
const SUBCOMMAND = 1
const STRING = 3
const USER = 6

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Read a `/su invite` out of an interaction body, or null when the body is not
 * one. A signature proves Discord sent it; this proves Discord sent **this
 * command**, so a signed `/su roll` cannot be replayed as an invite.
 */
export function parseInviteInteraction(rawBody: string): InviteInteraction | null {
  let body: {
    id?: unknown
    type?: unknown
    channel_id?: unknown
    member?: { user?: RawUser }
    user?: RawUser
    data?: {
      name?: unknown
      options?: unknown
      resolved?: { users?: Record<string, RawUser> }
    }
  }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return null
  }
  if (body === null || typeof body !== 'object') return null
  if (body.type !== APPLICATION_COMMAND || body.data?.name !== 'su') return null

  const interactionId = str(body.id)
  const inviterId = str(body.member?.user?.id) ?? str(body.user?.id)
  if (interactionId === null || inviterId === null) return null

  const subcommand = Array.isArray(body.data.options)
    ? (body.data.options[0] as RawOption | undefined)
    : undefined
  if (subcommand?.type !== SUBCOMMAND || subcommand.name !== 'invite') return null
  const options = (Array.isArray(subcommand.options) ? subcommand.options : []) as RawOption[]

  const userOption = options.find((o) => o.name === 'user' && o.type === USER)
  const inviteeId = str(userOption?.value)
  if (inviteeId === null) return null
  const resolved = body.data.resolved?.users?.[inviteeId]
  const username = str(resolved?.username)
  if (resolved === undefined || username === null) return null

  const seat = options.find((o) => o.name === 'seat' && o.type === STRING)?.value
  const game = options.find((o) => o.name === 'game' && o.type === STRING)?.value

  return {
    interactionId,
    inviterId,
    channelId: str(body.channel_id),
    invitee: {
      id: inviteeId,
      username,
      displayName: str(resolved.global_name) ?? username,
      bot: resolved.bot === true,
    },
    role: seat === 'mediator' ? 'mediator' : 'player',
    gameId: str(game),
  }
}
