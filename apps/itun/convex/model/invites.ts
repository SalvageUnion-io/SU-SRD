import { generateUniqueId } from '../../src/lib/snapshot/id'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * Minting and reading invites, shared by every door that creates one
 * (ADR-030's invite amendment, ADR-039).
 *
 * Two callers mint: `invites.create` (a code from the web) and the bot's
 * `/su invite` (a code addressed to a Discord account). They differ in who is
 * asking and how that was proven, and in nothing else — so the rules about what an invite *is* live here once, in
 * the same way `model/bot.ts` keeps "who may bind a channel" in one place.
 */

type AnyCtx = QueryCtx | MutationCtx

const DAY_MS = 1000 * 60 * 60 * 24

/** A bearer code lasts a fortnight unless the Organizer says otherwise. */
export const DEFAULT_EXPIRY_MS = DAY_MS * 14

/**
 * An addressed invite lasts a week: it is for one person, who has been told
 * about it directly, so it needs no fortnight of slack.
 */
export const TARGETED_EXPIRY_MS = DAY_MS * 7

/** What an invite is currently worth, derived rather than stored. */
export type InviteStatus = 'active' | 'revoked' | 'declined' | 'expired' | 'exhausted'

export type InviteTarget = NonNullable<Doc<'invites'>['target']>

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
  if (invite.expiresAt !== undefined && invite.expiresAt < now) return 'expired'
  if (invite.usesRemaining !== undefined && invite.usesRemaining <= 0) return 'exhausted'
  return 'active'
}

export type MintArgs = {
  usesRemaining?: number
  expiresInMs?: number
  label?: string
  role?: 'player' | 'mediator'
  grants?: Array<{ table: 'pilots' | 'mechs'; entityId: string }>
  requiresApproval?: boolean
  target?: InviteTarget
  sourceInteractionId?: string
}

/**
 * Insert an invite on behalf of an Organizer whose membership the caller has
 * already checked. Returns the row.
 *
 * The caller proves authority (a Convex token, or a Discord-signed
 * interaction); this decides only what the invite looks like.
 */
export async function mintInvite(
  ctx: MutationCtx,
  organizer: Doc<'memberships'>,
  args: MintArgs
): Promise<Doc<'invites'>> {
  const code = await generateUniqueId(async (candidate) => {
    const existing = await ctx.db
      .query('invites')
      .withIndex('by_code', (q) => q.eq('code', candidate))
      .unique()
    return existing !== null
  })

  const role = args.role ?? 'player'
  const grants = args.grants ?? []
  const target = args.target

  /*
   * Single use, unless the Organizer says otherwise, for three kinds of invite:
   *
   *   - A Mediator code. The schema permits several Mediators but the UI is
   *     built for one, so an unlimited one quietly seats a second.
   *   - A code carrying grants. Two people cannot both receive the same
   *     pilot; the second would join and silently get nothing.
   *   - An addressed invite — and for this one the Organizer does NOT get a
   *     say. It is for one person; a second use would be somebody else.
   */
  const defaultsToSingleUse = role === 'mediator' || grants.length > 0
  const usesRemaining =
    target !== undefined ? 1 : (args.usesRemaining ?? (defaultsToSingleUse ? 1 : undefined))

  /*
   * An addressed invite never needs approval: Discord has already proven who
   * will redeem it, and the Organizer chose that person. Asking them to
   * approve the knock would be asking them to confirm their own decision.
   */
  const requiresApproval = target !== undefined ? false : (args.requiresApproval ?? false)

  const now = Date.now()
  const defaultExpiry = target !== undefined ? TARGETED_EXPIRY_MS : DEFAULT_EXPIRY_MS
  const inviteId = await ctx.db.insert('invites', {
    gameId: organizer.gameId,
    code,
    createdBy: organizer.userId,
    createdAt: now,
    expiresAt: now + (args.expiresInMs ?? defaultExpiry),
    usesRemaining,
    label: args.label,
    role,
    grants: grants.length > 0 ? grants : undefined,
    requiresApproval,
    target,
    sourceInteractionId: args.sourceInteractionId,
  })

  const invite = await ctx.db.get(inviteId)
  if (invite === null) throw new Error('An invite vanished between insert and read')
  return invite
}

/**
 * The live invite already addressed to this Discord account for this Game, if
 * any. Inviting somebody twice re-sends the first invite rather than leaving
 * two codes for one person in the Organizer's list.
 */
export async function liveDiscordInvite(
  ctx: AnyCtx,
  gameId: Id<'games'>,
  discordId: string
): Promise<Doc<'invites'> | null> {
  const now = Date.now()
  const rows = await ctx.db
    .query('invites')
    .withIndex('by_target_discord', (q) => q.eq('target.discordId', discordId))
    .collect()
  return rows.find((row) => row.gameId === gameId && statusOf(row, now) === 'active') ?? null
}

/**
 * The Discord snowflake a user signed in with, or null.
 *
 * Read from `authAccounts`, the row `@convex-dev/auth` writes on every Discord
 * sign-in — the same source `model/bot.ts#userByDiscordId` reads in the other
 * direction, so an invite addressed by snowflake and the account that redeems
 * it are matched against one truth.
 */
export async function discordIdOfUser(ctx: AnyCtx, userId: Id<'users'>): Promise<string | null> {
  const account = await ctx.db
    .query('authAccounts')
    .withIndex('userIdAndProvider', (q) => q.eq('userId', userId).eq('provider', 'discord'))
    .first()
  return account?.providerAccountId ?? null
}

/**
 * Whether this user may spend this invite, as far as its address is concerned:
 * anyone may spend a bearer code, and only the account signed in with the
 * addressed snowflake may spend an addressed one.
 */
export async function mayRedeem(
  ctx: AnyCtx,
  invite: Doc<'invites'>,
  userId: Id<'users'>
): Promise<boolean> {
  if (invite.target === undefined) return true
  return (await discordIdOfUser(ctx, userId)) === invite.target.discordId
}
