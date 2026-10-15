import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * A Game's invite URL (ADR-030's invite amendment): one per Game, read and
 * minted here so `invites.ts` and `publicSheet.invitePreview` agree on which
 * code is the live one.
 */

type AnyCtx = QueryCtx | MutationCtx

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

/** Whether a row can be the Game's invite URL: an open standing link, never reset. */
function isCandidate(invite: Doc<'invites'>): boolean {
  return (
    invite.standing === true &&
    !invite.requiresApproval &&
    invite.revokedAt === undefined &&
    invite.target === undefined
  )
}

/**
 * The Game's invite URL, as its row, or null when none has been minted. It is
 * the newest open standing link that has not been reset; every other code the
 * Game holds opens nothing.
 */
export async function currentInvite(
  ctx: AnyCtx,
  gameId: Id<'games'>
): Promise<Doc<'invites'> | null> {
  const invites = await ctx.db
    .query('invites')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .collect()
  let current: Doc<'invites'> | null = null
  for (const invite of invites) {
    if (!isCandidate(invite)) continue
    if (current === null || invite._creationTime > current._creationTime) current = invite
  }
  return current
}

/** Whether this row is its Game's invite URL right now. */
export async function isCurrent(ctx: AnyCtx, invite: Doc<'invites'>): Promise<boolean> {
  return (await currentInvite(ctx, invite.gameId))?._id === invite._id
}

/**
 * Crockford base32: 0-9 and A-Z minus I, L, O and U.
 *
 * The token rides in the invite URL (`/invite/<token>`) and is never typed, so
 * it is long rather than short: sixteen characters, 80 bits. Eight-character
 * codes resolve through the same `by_code` index.
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

/** A code no invite already has. Retries on collision, and throws rather than loop forever. */
async function uniqueCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode()
    if ((await inviteByCode(ctx, code)) === null) return code
  }
  throw new Error('Failed to generate a unique invite code after max retries')
}

/**
 * Mint a new invite URL for the Organizer's Game. Returns the row. The caller
 * has already checked that `organizer` is the Game's Organizer.
 */
export async function mintInvite(
  ctx: MutationCtx,
  organizer: Doc<'memberships'>
): Promise<Doc<'invites'>> {
  const code = await uniqueCode(ctx)
  const now = Date.now()
  const inviteId = await ctx.db.insert('invites', {
    gameId: organizer.gameId,
    code,
    createdBy: organizer.userId,
    createdAt: now,
    standing: true,
  })
  const invite = await ctx.db.get(inviteId)
  if (invite === null) throw new Error('An invite vanished between insert and read')
  return invite
}
