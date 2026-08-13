import { ConvexError, v } from 'convex/values'
import { CrawlerSchema } from '../src/lib/schemas/crawler'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { parseBody } from './model/entities'
import { NotAuthorized, requireTableRunner, requireUser } from './model/permissions'

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
 *   by any argument — the table union below is the whole surface.
 * - **No refusal.** A non-public entity returns `null`, exactly as a
 *   nonexistent one does. "This sheet is private" is itself a disclosure.
 */

/** The three tables a public sheet can be. Never widened to `encounterNpcs`. */
const KIND_TO_TABLE = {
  pilot: 'pilots',
  mech: 'mechs',
  crawler: 'crawlers',
} as const

type Kind = keyof typeof KIND_TO_TABLE
type PublicTable = (typeof KIND_TO_TABLE)[Kind]

const kindValidator = v.union(v.literal('pilot'), v.literal('mech'), v.literal('crawler'))

/** Look one entity up by the client-minted app id the URL carries. */
async function byAppId(
  ctx: QueryCtx | MutationCtx,
  table: PublicTable,
  appId: string
): Promise<Doc<PublicTable> | null> {
  // `by_app_id` is an ordinary index and NOT a uniqueness constraint, so a
  // duplicate is possible. Resolving to the OLDEST match is what the rest of
  // the codebase does (`entities.byAppId`) and matters here for the same
  // reason: it is the row `maintenance.dedupeAppIds` keeps, so a public link
  // does not start pointing somewhere else after a repair runs.
  const rows = await ctx.db
    .query(table)
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .collect()
  if (rows.length === 0) return null
  return rows.reduce((oldest, row) => (row._creationTime < oldest._creationTime ? row : oldest))
}

/**
 * One published sheet, or null.
 *
 * **Unauthenticated by design** — see the module header. Returns the bare
 * entity body, which is exactly what `frozenSheet.ts` parses on the client, so
 * the public route reuses the renderer the snapshot page and the Game view
 * already share rather than adding a third.
 */
export const get = query({
  args: { kind: kindValidator, appId: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ kind: Kind; body: unknown; pilotAbilities?: string[] } | null> => {
    const row = await byAppId(ctx, KIND_TO_TABLE[args.kind], args.appId)
    // Not-public and not-found are the same answer on purpose: distinguishing
    // them would confirm that a given entity exists.
    if (row === null || row.publicRead !== true) return null

    return {
      kind: args.kind,
      body: row.body,
      ...(args.kind === 'mech' ? { pilotAbilities: await pilotAbilitiesForMech(ctx, row) } : {}),
    }
  },
})

/**
 * The abilities of the pilot flying this mech, for the renderer's maxima.
 *
 * A mech's Max SP and Cargo depend on its PILOT: Beefcake raises both on the
 * mech being piloted (ADR-029). A frozen sheet cannot see that — which is
 * exactly why a published snapshot has to carry `context.pilotAbilities`
 * alongside the entity — so without this a public mech would read *lower* than
 * the same mech on its owner's sheet.
 *
 * Resolving it here is the concrete form of ADR-032's claim that serving live
 * fixes what the frozen path cannot: the query runs on the server of record
 * with the whole `softLinks` graph in reach, rather than being handed whatever
 * was true when somebody last pressed publish.
 *
 * Deliberately does NOT check the pilot's own `publicRead`. This discloses no
 * pilot — not their name, not their existence, only a set of ability slugs
 * already implied by the mech's own numbers. Requiring the pilot to be public
 * too would silently give a wrong maximum, which is the bug this exists to fix.
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
  const pilot = await byAppId(ctx, 'pilots', link.to.id)
  if (pilot === null) return []

  // Same owner, or same Game. Either makes the pair a real pilot-and-mech;
  // neither is satisfiable by pointing a link at a stranger's id.
  //
  // Both ends are read through an `in` guard because `byAppId` returns the row
  // union — `crawlers` has no `ownerId` column at all — and narrowing it by the
  // table argument is not something Convex's index typing survives.
  const mechOwnerId = 'ownerId' in mech ? mech.ownerId : null
  const pilotOwnerId = 'ownerId' in pilot ? pilot.ownerId : null
  const sameOwner = pilotOwnerId !== null && pilotOwnerId === mechOwnerId
  const sameGame = mech.gameId !== null && pilot.gameId === mech.gameId
  if (!sameOwner && !sameGame) return []

  const abilities = (pilot.body as { abilities?: unknown }).abilities
  return Array.isArray(abilities) ? abilities.filter((a): a is string => typeof a === 'string') : []
}

/**
 * Whether the caller may publish this entity.
 *
 * Two different gates, because the entities differ. A pilot or mech is owned,
 * so publishing is the owner's call and nobody else's — deliberately NOT
 * `assertMayWrite`'s ctx-free sibling being reused loosely, but the same rule:
 * there is no Mediator override, because making somebody else's character
 * world-readable is the clearest possible case of a thing that is theirs to
 * decide. The crawler has no `ownerId` at all, so it follows ADR-030 §5a and is
 * the table runner's act, the same way raising and scrapping it are.
 */
async function assertMayPublish(
  ctx: MutationCtx,
  row: Doc<PublicTable>,
  userId: Id<'users'>
): Promise<void> {
  if (!('ownerId' in row)) {
    // `crawlers.gameId` is `v.id('games')` and never null — a crawler is always
    // in a Game, and a shelf crawler is not a thing — so there is deliberately
    // no null branch here to write.
    await requireTableRunner(ctx, row.gameId)
    return
  }
  if (row.ownerId === userId) return
  if (row.ownerId === null) {
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
 * URL per entity and it is derived rather than minted — so unlike an ADR-004
 * snapshot there is no set of outstanding links to chase down.
 */
export const setPublic = mutation({
  args: { kind: kindValidator, appId: v.string(), isPublic: v.boolean() },
  handler: async (ctx, args): Promise<{ isPublic: boolean }> => {
    const userId = await requireUser(ctx)
    const table = KIND_TO_TABLE[args.kind]
    const row = await byAppId(ctx, table, args.appId)
    if (row === null) throw new NotAuthorized('That entity no longer exists')

    await assertMayPublish(ctx, row, userId)

    // Parse before publishing, exactly as every other mutation parses before
    // persisting (ADR-030): the Zod schemas in `src/lib/schemas/` are the
    // source of truth and Convex stores bodies opaquely. A body that cannot be
    // parsed would hand the public route something `frozenSheet.ts` will
    // refuse to render, so this fails HERE — where the owner is standing and
    // can see it — rather than on a page they have already given somebody.
    //
    // Crawlers go through `CrawlerSchema` directly because `PARSERS` does not
    // cover that table; `entities.ts` validates crawler writes the same way,
    // for the same reason. Widening `PARSERS` would change how crawler writes
    // behave elsewhere, which is not this change's business.
    //
    // Both branches throw `ConvexError`, and that is the load-bearing part.
    // `parseBody` throws a plain `Error`, which Convex redacts to "Server
    // Error" before the client sees it — so re-throwing as `ConvexError` is
    // what makes this message actually reach the owner instead of being
    // written and then discarded. Without it the promise above ("fails HERE,
    // where the owner can see it") would have held for crawlers only.
    if (args.isPublic) {
      try {
        if (table === 'crawlers') {
          const parsed = CrawlerSchema.safeParse(row.body)
          if (!parsed.success) {
            throw new Error(parsed.error.issues[0]?.message ?? 'unknown')
          }
        } else {
          parseBody(table, row.body)
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown'
        throw new ConvexError(`This ${args.kind} cannot be shared publicly: ${detail}`)
      }
    }

    await ctx.db.patch(row._id, { publicRead: args.isPublic })
    return { isPublic: args.isPublic }
  },
})
