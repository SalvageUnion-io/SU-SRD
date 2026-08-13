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
  handler: async (ctx, args): Promise<{ kind: Kind; body: unknown } | null> => {
    const row = await byAppId(ctx, KIND_TO_TABLE[args.kind], args.appId)
    // Not-public and not-found are the same answer on purpose: distinguishing
    // them would confirm that a given entity exists.
    if (row === null || row.publicRead !== true) return null
    return { kind: args.kind, body: row.body }
  },
})

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
    // A crawler always belongs to a Game; a shelf crawler is not a thing.
    if (row.gameId === null) throw new NotAuthorized('That crawler is not in a game')
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
    if (args.isPublic) {
      if (table === 'crawlers') {
        const parsed = CrawlerSchema.safeParse(row.body)
        if (!parsed.success) {
          throw new ConvexError(
            `This crawler cannot be published: ${parsed.error.issues[0]?.message ?? 'unknown'}`
          )
        }
      } else {
        parseBody(table, row.body)
      }
    }

    await ctx.db.patch(row._id, { publicRead: args.isPublic })
    return { isPublic: args.isPublic }
  },
})
