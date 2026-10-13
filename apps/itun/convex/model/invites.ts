import type { Infer } from 'convex/values'
import { v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * Minting and reading invites (ADR-030's invite amendment): `invites.create`
 * and `invites.link` both mint here, so what an invite *is* lives once.
 */

type AnyCtx = QueryCtx | MutationCtx

const DAY_MS = 1000 * 60 * 60 * 24

/** A bearer code lasts a fortnight unless the Organizer says otherwise. */
export const DEFAULT_EXPIRY_MS = DAY_MS * 14

/**
 * The invite a code names, or null. Codes are matched trimmed and
 * case-insensitively, so every door that takes one agrees on what it names.
 */
export async function inviteByCode(ctx: AnyCtx, raw: string): Promise<Doc<'invites'> | null> {
  const code = raw.trim().toUpperCase()
  if (code.length === 0) return null
  return await ctx.db
    .query('invites')
    .withIndex('by_code', (q) => q.eq('code', code))
    .unique()
}

/** What an invite is currently worth, derived rather than stored. */
export const inviteStatus = v.union(
  v.literal('active'),
  v.literal('revoked'),
  v.literal('declined'),
  v.literal('expired'),
  v.literal('exhausted')
)
export type InviteStatus = Infer<typeof inviteStatus>

/**
 * Derive status from the row and the clock.
 *
 * Deliberately not a stored column: an `expired` flag would need a cron to stay
 * true, and a stale one would let a dead code through. Revoked outranks
 * declined — if the Organizer closed it, that is the more useful thing to say.
 */
export function statusOf(invite: Doc<'invites'>, now: number): InviteStatus {
  if (invite.revokedAt !== undefined) return 'revoked'
  if (invite.declinedAt !== undefined) return 'declined'
  if (invite.expiresAt < now) return 'expired'
  if (invite.usesRemaining !== undefined && invite.usesRemaining <= 0) return 'exhausted'
  return 'active'
}

export type MintArgs = {
  usesRemaining?: number
  expiresInMs?: number
  label?: string
  role?: 'player' | 'mediator'
  requiresApproval?: boolean
  /** The Game's standing link for its creator's door (`invites.link`). */
  standing?: boolean
}

/**
 * Crockford base32: 0-9 and A-Z minus I, L, O and U.
 *
 * The token rides in an invite link (`/invite/<token>`) and is never typed, so
 * it is long rather than short: sixteen characters, 80 bits, where the typed
 * code it replaced had eight. Codes minted before the switch keep their
 * eight characters and still resolve, through the same `by_code` index.
 */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 16
const MAX_CODE_ATTEMPTS = 5

/**
 * Sixteen random Crockford-base32 characters (80 bits), from
 * `crypto.getRandomValues`. 256 is a multiple of 32, so `b % 32` is unbiased.
 */
function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join('')
}

/**
 * A code no invite already has. Retries on collision, which at ~40 bits is
 * vanishingly rare, and throws rather than loop forever.
 */
async function uniqueCode(exists: (code: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode()
    if (!(await exists(code))) return code
  }
  throw new Error('Failed to generate a unique invite code after max retries')
}

/**
 * Insert an invite on behalf of a member whose membership the caller has
 * already checked — an Organizer, or (for `invites.link`'s approval link) any
 * member. Returns the row.
 *
 * The caller proves authority and decides what that member may mint; this
 * decides only what the invite looks like.
 */
export async function mintInvite(
  ctx: MutationCtx,
  organizer: Doc<'memberships'>,
  args: MintArgs
): Promise<Doc<'invites'>> {
  const code = await uniqueCode(async (candidate) => {
    const existing = await ctx.db
      .query('invites')
      .withIndex('by_code', (q) => q.eq('code', candidate))
      .unique()
    return existing !== null
  })

  const role = args.role ?? 'player'

  // A Mediator code is single use unless the Organizer says otherwise: the
  // schema permits several Mediators but the UI is built for one, so an
  // unlimited one quietly seats a second.
  const usesRemaining = args.usesRemaining ?? (role === 'mediator' ? 1 : undefined)

  const now = Date.now()
  const inviteId = await ctx.db.insert('invites', {
    gameId: organizer.gameId,
    code,
    createdBy: organizer.userId,
    createdAt: now,
    expiresAt: now + (args.expiresInMs ?? DEFAULT_EXPIRY_MS),
    usesRemaining,
    label: args.label,
    role,
    requiresApproval: args.requiresApproval ?? false,
    standing: args.standing,
  })

  const invite = await ctx.db.get(inviteId)
  if (invite === null) throw new Error('An invite vanished between insert and read')
  return invite
}

/**
 * Whether this user may spend this invite, as far as its address is concerned.
 *
 * No door mints an addressed invite any more, but rows `/su invite` minted
 * still carry a `target` until they expire (a week after minting): such a row
 * is spendable only by the account signed in with that Discord snowflake, read
 * from `authAccounts` as `model/bot.ts#userByDiscordId` reads it. Anyone may
 * spend a bearer code.
 */
export async function mayRedeem(
  ctx: AnyCtx,
  invite: Doc<'invites'>,
  userId: Id<'users'>
): Promise<boolean> {
  if (invite.target === undefined) return true
  const account = await ctx.db
    .query('authAccounts')
    .withIndex('userIdAndProvider', (q) => q.eq('userId', userId).eq('provider', 'discord'))
    .first()
  return account?.providerAccountId === invite.target.discordId
}
