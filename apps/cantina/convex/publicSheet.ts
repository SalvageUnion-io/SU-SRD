import { getAuthUserId } from '@convex-dev/auth/server'
import type { Infer } from 'convex/values'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import type { SheetKind } from './model/entities'
import {
  linksTouching,
  mayReadPattern,
  mutation,
  oldestByAppId,
  parseBody,
  patternByAppId,
  patternVisibility,
  patternVisibilityOf,
  resolveLinkEnd,
  sameContainerRows,
  TABLE_OF_KIND,
} from './model/entities'
import { inviteByCode, isCurrent } from './model/invites'
import { NotAuthorized, requireTableRunner, requireUser } from './model/permissions'
import { entityRef, entityRefType, softLinkType } from './schema'

/**
 * Public, read-only sheets (ADR-032).
 *
 * One **unauthenticated** query, and one owner-gated mutation that turns a
 * single entity into something it can serve.
 *
 * ## Why this is allowed to be unauthenticated
 *
 * ADR-030 §5 says visibility begins at membership, and this is the one
 * deliberate exception to it. What makes the exception safe is that it is not a
 * general read: `get` serves an entity only when its owner has explicitly set
 * `publicRead`, so the default for every row that exists — and every row
 * created from now on — is unchanged.
 *
 * `invites.preview` is the precedent for the shape. It is unauthenticated on
 * purpose, because refusing to say what a link is for until somebody signs in
 * is how you get a person signing in to find out they were sent a dead code.
 * The same argument applies to a sheet somebody has deliberately published.
 *
 * ## What it deliberately does not do
 *
 * - **No listing.** There is no way to enumerate public sheets, by owner, by
 *   Game or at all. You can read one you have the URL for; you cannot discover
 *   one.
 * - **No `encounterNpcs`.** The Mediator's prepared opposition is not an
 *   ownable entity, has no `publicRead` column, and is not reachable from here
 *   by any argument — `TABLE_OF_KIND` is the whole surface.
 * - **No refusal.** A non-public entity returns `null`, exactly as a
 *   nonexistent one does. "This sheet is private" is itself a disclosure.
 *
 * ## Mech patterns join it
 *
 * A saved mech pattern is the one thing a player MAKES that can be published
 * here, at `/p/pattern/:appId`, with the same `publicRead` opt-in. It has its
 * own query, `pattern`, rather than a `TABLE_OF_KIND` entry: a pattern
 * has no assignments and no maxima, and it has a second audience — a Game's
 * crew — that a sheet reaches through the Game view instead. The rules above
 * hold for it unchanged: no listing, and private reads as nonexistent.
 *
 * ## Built NPCs join it
 *
 * A built NPC (ADR-044) is owned exactly like a pilot, so it publishes exactly
 * like one: the same `publicRead` opt-in, the same owner-only gate, and its own
 * page at `/p/npc/:appId`. Its page credits its maker (ruleset §3.9), so `get`
 * names them for an NPC, as `pattern` does for a pattern.
 */

type Kind = SheetKind
/** The four tables a public sheet can be. */
type PublicTable = (typeof TABLE_OF_KIND)[Kind]

/** A sheet's kind: `EntityRefSchema.type`, built from Zod in `schema.ts`. */
const kindValidator = entityRefType

/** One assignment of a published entity, as the reader's sheet draws it. */
const publicLink = v.object({ type: softLinkType, from: entityRef, to: entityRef })
type PublicLink = Infer<typeof publicLink>

/**
 * A linked entity that is published itself: what its own `/p/` page shows, so
 * the reader's rail can carry its vitals and a way in.
 */
const publicLinked = v.object({
  kind: kindValidator,
  id: v.string(),
  name: v.string(),
  body: v.any(),
})
type PublicLinked = Infer<typeof publicLinked>

/**
 * A linked entity that is NOT published: its kind, and nothing else — no name,
 * no id, no link. Publishing is each owner's own opt-in (decision 2), so a
 * crewmate's private pilot is not named on somebody else's public crawler; the
 * reader's sheet says the slot is filled ("Not shared") without saying by whom.
 */
const publicWithheld = v.object({ kind: kindValidator })
type PublicWithheld = Infer<typeof publicWithheld>

/** One published sheet, as `get` serves it. */
const publicSheet = v.object({
  kind: kindValidator,
  body: v.any(),
  /** A mech's pilot's abilities, for its maxima (`pilotAbilitiesForMech`). */
  pilotAbilities: v.optional(v.array(v.string())),
  /** An NPC's maker, for its "Made by" credit (ruleset §3.9). */
  madeBy: v.optional(v.string()),
  links: v.array(publicLink),
  linked: v.array(publicLinked),
  withheld: v.array(publicWithheld),
})

/**
 * One published sheet, or null.
 *
 * **Unauthenticated by design** — see the module header. Returns the bare
 * entity body and its direct assignments: the published ones in full (`linked`,
 * with the `links` that reach them), the rest by kind alone (`withheld`). The
 * client renders them through the live read-only sheet store every other
 * read-only surface uses (`readOnlySheetStore.model.ts`).
 */
export const get = query({
  args: { kind: kindValidator, appId: v.string() },
  returns: v.union(publicSheet, v.null()),
  handler: async (ctx, args): Promise<Infer<typeof publicSheet> | null> => {
    const row = await oldestByAppId(ctx, TABLE_OF_KIND[args.kind], args.appId)
    // Not-public and not-found are the same answer on purpose: distinguishing
    // them would confirm that a given entity exists.
    if (row === null || row.publicRead !== true) return null

    return {
      kind: args.kind,
      body: row.body,
      ...(args.kind === 'mech' ? { pilotAbilities: await pilotAbilitiesForMech(ctx, row) } : {}),
      ...(args.kind === 'npc'
        ? {
            madeBy: displayNameOf(row.ownerId ? await ctx.db.get(row.ownerId) : null, 'a player'),
          }
        : {}),
      ...(await assignmentsOf(ctx, row, args.appId)),
    }
  },
})

/**
 * A published entity's direct assignments, split by whether the far end is
 * published itself.
 *
 * Only a link whose far end sits in the **same container** counts at all. Rows
 * older than the one-container rule (ADR-037) can still straddle two, and a
 * link's `to.id` was once a free string — so a cross-container link is stale or
 * forged data, not an assignment, and serving it would let anyone who can draw
 * a link out of their own published entity attach a stranger's to it.
 */
async function assignmentsOf(
  ctx: QueryCtx,
  row: Doc<PublicTable>,
  appId: string
): Promise<{ links: PublicLink[]; linked: PublicLinked[]; withheld: PublicWithheld[] }> {
  const links: PublicLink[] = []
  const linked = new Map<string, PublicLinked>()
  const withheld = new Map<string, PublicWithheld>()
  for (const link of await linksTouching(ctx, appId)) {
    const far = link.from.id === appId ? link.to : link.from
    // A public crawler page draws its book crew line, not a built NPC's
    // (ADR-044): an NPC is read on its own page, so its crew link is not one
    // a public sheet shows.
    if (far.type === 'npc') continue
    const target = await resolveLinkEnd(ctx, far, row.gameId)
    if (target === null || !sameContainerRows(row, target)) continue
    // Keyed by the far end so each entity counts once. The key never leaves
    // this function for a withheld one.
    const key = `${far.type}:${far.id}`
    if (target.publicRead === true) {
      links.push({ type: link.type, from: link.from, to: link.to })
      linked.set(key, {
        kind: far.type,
        id: far.id,
        name: nameOf(target.body, far.type),
        body: target.body,
      })
    } else {
      withheld.set(key, { kind: far.type })
    }
  }
  return { links, linked: [...linked.values()], withheld: [...withheld.values()] }
}

/** A body's display name, or its kind when it carries none. */
function nameOf(body: unknown, kind: Kind): string {
  const name = (body as { name?: unknown } | null)?.name
  if (typeof name === 'string' && name.length > 0) return name
  return kind === 'pilot'
    ? 'Pilot'
    : kind === 'mech'
      ? 'Mech'
      : kind === 'crawler'
        ? 'Crawler'
        : 'NPC'
}

/**
 * The abilities of the pilot flying this mech, for the renderer's maxima.
 *
 * A mech's Max SP and Cargo depend on its PILOT: Beefcake raises both on the
 * mech being piloted (ADR-029), so without this a public mech would read
 * *lower* than the same mech on its owner's sheet.
 *
 * Resolving it here is the concrete form of ADR-032's claim that serving live
 * fixes what the frozen path cannot: the query runs on the server of record
 * with the whole `softLinks` graph in reach, rather than being handed whatever
 * was true when somebody last pressed publish.
 *
 * Deliberately does NOT require the pilot's own `publicRead`. Their sheet stays
 * private — `withheld` carries only their kind — and this adds nothing but a
 * set of ability slugs already implied by the mech's own numbers. Requiring the
 * pilot to be public too would silently give a wrong maximum, which is the bug
 * this exists to fix.
 *
 * It DOES check that the pilot actually belongs with the mech, and that check
 * is load-bearing. `upsertSoftLink` validates only the `from` anchor — wiring
 * your own mech to a crewmate's pilot is your business — and `to.id` is a
 * free-form string. So without this, anyone could point a link from their own
 * published mech at an arbitrary pilot's `appId` and have this unauthenticated
 * query read that stranger's abilities back out. The "discloses no pilot"
 * argument above only holds while the linked pilot is genuinely this mech's
 * pilot, so that is required rather than assumed.
 */
async function pilotAbilitiesForMech(ctx: QueryCtx, mech: Doc<PublicTable>): Promise<string[]> {
  // Takes the row union rather than `Doc<'mechs'>` because `args.kind` and the
  // row's table are correlated in fact but not in the type system, and a cast
  // to bridge that would be a worse trade than reading three fields
  // structurally. `ownerId` is absent on crawlers, which this handles.
  const mechAppId = mech.appId
  if (mechAppId === undefined) return []

  const link = (
    await ctx.db
      .query('softLinks')
      .withIndex('by_from', (q) => q.eq('from.id', mechAppId))
      .collect()
  ).find((l) => l.type === 'mech-to-pilot')
  if (link === undefined) return []

  // Soft links address entities by APP id (ADR-027), the same id this route
  // takes — not by Convex row id.
  const pilot = await oldestByAppId(ctx, 'pilots', link.to.id)
  if (pilot === null) return []

  // The pilot must be the mech owner's own, or unclaimed alongside it.
  //
  // "Same Game" is deliberately NOT enough. `upsertSoftLink` validates only the
  // `from` anchor, so a member could point a link from their own mech at a
  // crewmate's pilot, publish the mech, and have this hand that pilot's
  // abilities to anonymous readers. Members can already read each other's
  // sheets inside a Game — but republishing that outside the membership
  // boundary is the owner's call, which is the whole consent argument this
  // module rests on. An unclaimed pilot in the same Game has no owner to ask
  // and is already visible to the table, so it stays allowed.
  //
  // Both ends are read through an `in` guard because `oldestByAppId` returns the row
  // union — `crawlers` has no `ownerId` column at all — and narrowing it by the
  // table argument is not something Convex's index typing survives.
  //
  // A pilot published in its own right is the third case: its abilities are on
  // its own public page already, so passing them on discloses nothing — and
  // withholding them would read the mech lower than the pilot's public rail
  // shows it, now that the reader's sheet draws both.
  const mechOwnerId = 'ownerId' in mech ? mech.ownerId : null
  const pilotOwnerId = 'ownerId' in pilot ? pilot.ownerId : null
  const sameOwner = pilotOwnerId !== null && pilotOwnerId === mechOwnerId
  const unclaimedInSameGame =
    pilotOwnerId === null && mech.gameId !== null && pilot.gameId === mech.gameId
  const publishedAlongside = pilot.publicRead === true && sameContainerRows(mech, pilot)
  if (!sameOwner && !unclaimedInSameGame && !publishedAlongside) return []

  const abilities = (pilot.body as { abilities?: unknown }).abilities
  return Array.isArray(abilities) ? abilities.filter((a): a is string => typeof a === 'string') : []
}

/**
 * Whether the caller may publish this entity.
 *
 * Two different gates, because the entities differ. A pilot, mech or NPC is owned,
 * so publishing is the owner's call and nobody else's — deliberately NOT
 * `assertMayWrite`'s ctx-free sibling being reused loosely, but the same rule:
 * there is no Mediator override, because making somebody else's character
 * world-readable is the clearest possible case of a thing that is theirs to
 * decide. A crawler in a Game is communal and owned by nobody, so it follows
 * ADR-030 §5a and is the table runner's act, the same way raising and scrapping
 * it are.
 *
 * ## Why this takes the table rather than sniffing the row
 *
 * Every row carries an `ownerId` column, so the row's shape cannot tell the
 * tables apart. Passing the table makes the distinction explicit, and the
 * caller already has it in hand.
 *
 * The two gates cannot simply be merged, even though all three rows carry
 * the same columns, because an **unclaimed** row means opposite things per
 * table. An unclaimed pilot is a character waiting for a taker and may not be
 * published until somebody owns it; an unclaimed crawler is the normal state of
 * a crew's home and is published by whoever runs the table.
 */
async function assertMayPublish(
  ctx: MutationCtx,
  table: PublicTable,
  row: Doc<PublicTable>,
  userId: Id<'users'>,
  isPublic: boolean
): Promise<void> {
  if (table === 'crawlers') {
    // In a Game: communal, so the table runner decides (ADR-030 §5a). On a
    // shelf: an ordinary owned entity, so its owner does — the same rule the
    // ownable branch below applies, and for the same reason.
    if (row.gameId !== null) {
      await requireTableRunner(ctx, row.gameId)
      return
    }
    if (row.ownerId === userId) return
    throw new NotAuthorized("You cannot publish another player's crawler")
  }
  if (row.ownerId === userId) return
  if (row.ownerId === null) {
    // **Unclaimed blocks publishing, never UN-publishing.** `ownership.release`
    // nulls `ownerId` on a row still in the Game, so refusing withdrawal would
    // leave a published sheet un-revocable (ADR-032 §6). Withdrawal only
    // reduces exposure.
    if (!isPublic) return
    throw new NotAuthorized(
      'That entity is unclaimed — it must be assigned before it can be shared'
    )
  }
  throw new NotAuthorized("You cannot publish another player's entity")
}

/**
 * Publish or unpublish one sheet.
 *
 * Unpublishing takes effect everywhere at once, because there is exactly one
 * URL per entity and it is derived rather than minted, so there is no set of
 * outstanding links to chase down.
 */
export const setPublic = mutation({
  args: { kind: kindValidator, appId: v.string(), isPublic: v.boolean() },
  handler: async (ctx, args): Promise<{ isPublic: boolean }> => {
    const userId = await requireUser(ctx)
    const table = TABLE_OF_KIND[args.kind]
    const row = await oldestByAppId(ctx, table, args.appId)
    if (row === null) throw new NotAuthorized('That entity no longer exists')

    await assertMayPublish(ctx, table, row, userId, args.isPublic)

    // Parse before publishing, exactly as every other mutation parses before
    // persisting (ADR-030): the Zod schemas in `cantina-domain/schemas/` are the
    // source of truth and Convex stores bodies opaquely. A body that cannot be
    // parsed would hand the public route something it will refuse to
    // render, so this fails HERE — where the owner is standing and
    // can see it — rather than on a page they have already given somebody.
    //
    // `parseBody` throws a plain `Error`, which Convex redacts to "Server
    // Error" before the client sees it, so it is re-thrown as `ConvexError`:
    // that is what makes this message reach the owner.
    if (args.isPublic) {
      try {
        parseBody(table, row.body)
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown'
        throw new ConvexError(`This ${args.kind} cannot be shared publicly: ${detail}`)
      }
    }

    await ctx.db.patch(row._id, { publicRead: args.isPublic })
    return { isPublic: args.isPublic }
  },
})

/** One readable pattern, as its page draws it. */
const patternAnswer = v.object({
  body: v.any(),
  /** The maker's display name: the page's only credit (ruleset §3.9). */
  madeBy: v.string(),
  /** When it was shared, for the page's foot; null while it is the maker's alone. */
  sharedAt: v.union(v.number(), v.null()),
  /** Mechs built from it so far. */
  builtCount: v.number(),
  /** The reader made it. */
  mine: v.boolean(),
  /** Who may read it — told to its maker only. */
  visibility: v.union(patternVisibility, v.null()),
})
type PatternAnswer = Infer<typeof patternAnswer>

/**
 * One saved mech pattern, or null.
 *
 * **Unauthenticated by design**, like `get`: a pattern shared by link is
 * readable with no account. A signed-in reader also reaches one shared with a
 * Game they are in, and their own. Everything else — private, another crew's,
 * or no such pattern — is the same `null`.
 */
export const pattern = query({
  args: { appId: v.string() },
  returns: v.union(patternAnswer, v.null()),
  handler: async (ctx, args): Promise<PatternAnswer | null> => {
    const row = await patternByAppId(ctx, args.appId)
    if (row === null) return null
    const userId = await getAuthUserId(ctx)
    if (!(await mayReadPattern(ctx, row, userId))) return null

    const maker = await ctx.db.get(row.ownerId)
    const mine = row.ownerId === userId
    return {
      body: row.body,
      madeBy: displayNameOf(maker, 'a player'),
      sharedAt: row.sharedAt ?? null,
      builtCount: row.builtCount ?? 0,
      mine,
      visibility: mine ? patternVisibilityOf(row) : null,
    }
  },
})

/**
 * The kinds of player thing a link can preview: the four sheets
 * and a shared mech pattern.
 */
const previewKindValidator = v.union(...entityRefType.members, v.literal('pattern'))

/** What a link preview of one player thing may say. */
const previewAnswer = v.object({
  kind: previewKindValidator,
  body: v.any(),
  /** The player who owns it (a sheet) or made it (a pattern); null when unclaimed. */
  ownerName: v.union(v.string(), v.null()),
  /** The Game a sheet sits in; null on a shelf, and always null for a pattern. */
  gameName: v.union(v.string(), v.null()),
  /**
   * A pilot's mech, as its chassis slug: the one mech assigned to it that is
   * published itself, or null. A private mech is not named (the card's MECH
   * cell reads as empty), as `assignmentsOf` withholds it from the page.
   */
  mechChassisRef: v.optional(v.union(v.string(), v.null())),
})
type PreviewAnswer = Infer<typeof previewAnswer>

/**
 * One player thing, as its link preview shows it to a STRANGER,
 * or null.
 *
 * **Unauthenticated by design**, and stricter than the pages it previews:
 * whoever asks, it serves only what anyone with the link may read — a sheet
 * or a pattern with `publicRead` set — never a crew-shared pattern, even to
 * its crew, because an unfurl is posted where strangers read it. A preview
 * never shows more than the page would show a stranger.
 *
 * Beyond the body the page already serves, it names the owner (a sheet's
 * byline, "Rosa's pilot", and a pattern's "Made by") and a sheet's Game. That
 * is the owner's own choice to publish, made on their own sheet; it names
 * nobody else, and like `get` it answers a private thing with the same null
 * as a missing one.
 */
export const preview = query({
  args: { kind: previewKindValidator, appId: v.string() },
  returns: v.union(previewAnswer, v.null()),
  handler: async (ctx, args): Promise<PreviewAnswer | null> => {
    if (args.kind === 'pattern') {
      const row = await patternByAppId(ctx, args.appId)
      if (row === null || row.publicRead !== true) return null
      return {
        kind: 'pattern',
        body: row.body,
        ownerName: displayNameOf(await ctx.db.get(row.ownerId), 'a player'),
        gameName: null,
      }
    }
    const row = await oldestByAppId(ctx, TABLE_OF_KIND[args.kind], args.appId)
    if (row === null || row.publicRead !== true) return null
    const ownerId = 'ownerId' in row ? row.ownerId : null
    const game = row.gameId !== null ? await ctx.db.get(row.gameId) : null
    return {
      kind: args.kind,
      body: row.body,
      ownerName: ownerId ? displayNameOf(await ctx.db.get(ownerId), null) : null,
      gameName: game?.name ?? null,
      ...(args.kind === 'pilot'
        ? { mechChassisRef: await publishedMechOf(ctx, row, args.appId) }
        : {}),
    }
  },
})

/**
 * The chassis slug of the mech assigned to this pilot, when that mech is
 * published itself; null otherwise. The same rule as `assignmentsOf`: the far
 * end must sit in the pilot's container and carry its own `publicRead`, so a
 * preview never names a mech the page would withhold from a stranger.
 */
async function publishedMechOf(
  ctx: QueryCtx,
  pilot: Doc<PublicTable>,
  appId: string
): Promise<string | null> {
  for (const link of await linksTouching(ctx, appId)) {
    if (link.type !== 'mech-to-pilot') continue
    const far = link.from.id === appId ? link.to : link.from
    if (far.type !== 'mech') continue
    const target = await resolveLinkEnd(ctx, far, pilot.gameId)
    if (target === null || !sameContainerRows(pilot, target) || target.publicRead !== true) continue
    const chassisRef = (target.body as { chassisRef?: unknown } | null)?.chassisRef
    if (typeof chassisRef === 'string' && chassisRef.length > 0) return chassisRef
  }
  return null
}

/** What a Game invite's link preview may say: never the code, never the crew. */
const invitePreviewAnswer = v.object({
  gameName: v.string(),
  /** Who runs the table: the Game's Mediator, by display name. */
  mediatedBy: v.union(v.string(), v.null()),
})
type InvitePreviewAnswer = Infer<typeof invitePreviewAnswer>

/**
 * A Game invite, as its link preview shows it: the Game's name and who
 * mediates, or null for a code that is not the Game's invite URL. **Unauthenticated**, like `invites.preview`, which already tells a
 * link holder the Game's name and who invited them; this adds only the
 * Mediator's name, the one person a player is asking to join.
 */
export const invitePreview = query({
  args: { code: v.string() },
  returns: v.union(invitePreviewAnswer, v.null()),
  handler: async (ctx, args): Promise<InvitePreviewAnswer | null> => {
    const invite = await inviteByCode(ctx, args.code)
    if (invite === null || !(await isCurrent(ctx, invite))) return null
    const game = await ctx.db.get(invite.gameId)
    if (game === null) return null
    const mediator = (
      await ctx.db
        .query('memberships')
        .withIndex('by_game', (q) => q.eq('gameId', invite.gameId))
        .collect()
    ).find((membership) => membership.mediator)
    return {
      gameName: game.name,
      mediatedBy: mediator ? displayNameOf(await ctx.db.get(mediator.userId), null) : null,
    }
  },
})
