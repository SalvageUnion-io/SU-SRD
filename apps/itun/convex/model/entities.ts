import { customCtx, customMutation } from 'convex-helpers/server/customFunctions'
import { Triggers } from 'convex-helpers/server/triggers'
import { CrawlerSchema } from '../../src/lib/schemas/crawler'
import { EncounterNpcSchema } from '../../src/lib/schemas/encounterNpc'
import { MechSchema } from '../../src/lib/schemas/mech'
import { MechPatternSchema } from '../../src/lib/schemas/pattern'
import { PilotSchema } from '../../src/lib/schemas/pilot'
import type { DataModel, Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
} from '../_generated/server'

/**
 * Shared entity-document helpers for the mutation modules (ADR-030).
 *
 * Three obligations live here, and they are here because every one of those
 * modules owes them. The first two had each grown a copy per module; the third
 * — the mutation builders at the bottom, which run the `games.summary`
 * triggers — only works if every module takes it from one place.
 *
 * ## The edge parse
 *
 * `schema.ts` stores entity bodies as `v.any()` so the Zod schemas in
 * `src/lib/schemas/` stay the single source of truth rather than being forked
 * into a second, hand-maintained set of Convex validators. The price is stated
 * plainly in that file's header: **Convex cannot reject a malformed body on
 * write, so the mutation has to.** `parseBody` is where that is paid, and
 * `PARSERS` is the whole list of tables that owe it — a table missing from the
 * map is a table nothing validates.
 *
 * ## The id-normalizing load
 *
 * `normalizeId` is what makes a table name load-bearing rather than decorative:
 * a Convex id is table-tagged, but `db.get` returns a document from ANY table,
 * so casting a client-supplied id string let a caller reach a row the named
 * table does not hold — a `mechPatterns` id through the `mechs` endpoint would
 * have been parsed with the mech schema and patched, and an id from a table
 * nobody may claim through could have reached the ownership writes. An id that
 * is not this table's is simply not there, which is also what the old
 * `'ownerId' in doc` guard was groping for.
 */

/** The two entity tables that carry an owner. Crawlers are communal by design. */
export type OwnableTable = 'pilots' | 'mechs'

/**
 * What the Mediator's opposition tray may write.
 *
 * Deliberately a *partial* of the local `EncounterNpcSchema` rather than the
 * whole thing. That schema describes a tracked instance in the local store —
 * reference slug, HP track, conditions, timestamps — whereas the tray on the
 * server holds prepared opposition that has not been instantiated yet, and the
 * Mediator surface sends only a name. Demanding the full record here would
 * reject every write the app actually makes, which is a broken feature rather
 * than a validated one.
 *
 * What it still buys, and what the table had none of before: a body must be an
 * object, every field it *does* carry must be the shape the local store will
 * read, nothing outside the schema can be written at all (it is `.strict()`),
 * and a name must be there — the one field every reader of this table uses.
 */
const EncounterNpcBodySchema = EncounterNpcSchema.partial().extend({
  name: EncounterNpcSchema.shape.name,
})

/** Every table whose `v.any()` body is validated at the edge, and by what. */
export const PARSERS = {
  pilots: PilotSchema,
  mechs: MechSchema,
  crawlers: CrawlerSchema,
  encounterNpcs: EncounterNpcBodySchema,
  mechPatterns: MechPatternSchema,
} as const

export type ParsedTable = keyof typeof PARSERS

/** Parse a body against its Zod schema, or throw with a legible reason. */
export function parseBody(table: ParsedTable, body: unknown): unknown {
  const result = PARSERS[table].safeParse(body)
  if (!result.success) {
    throw new Error(`Invalid ${table} payload: ${result.error.issues[0]?.message ?? 'unknown'}`)
  }
  return result.data
}

/**
 * Load an ownable entity from a client-supplied id string, or throw.
 *
 * See the module header for why `normalizeId` is not optional here. `table`
 * accepts null so a caller that maps an entity *type* onto a table (see
 * `ownableTableFor` in `proposals.ts`) can hand the unmapped case straight in
 * and get the same "no longer exists" answer, rather than inventing a second
 * one for a case that means exactly the same thing to the caller.
 */
export async function loadOwnable(
  ctx: MutationCtx,
  table: OwnableTable | null,
  entityId: string
): Promise<Doc<'pilots'> | Doc<'mechs'>> {
  const id = table === null ? null : ctx.db.normalizeId(table, entityId)
  if (id === null) throw new Error('That entity no longer exists')

  const doc = await ctx.db.get(id)
  if (doc === null) throw new Error('That entity no longer exists')
  return doc
}

/**
 * The id a body carries for itself, or undefined when it carries none.
 *
 * Patterns and NPCs are identified by `body.id` — the local store keys them by
 * it — and the row's `appId` column is that same value lifted out so it can be
 * indexed. This is the one place that decides what counts as one.
 */
export function bodyAppId(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const id = (body as { id?: unknown }).id
  return typeof id === 'string' ? id : undefined
}

/** The two tables whose rows are identified by the id inside their body. */
export type BodyIdTable = 'mechPatterns' | 'encounterNpcs'

/**
 * One of the owner's own patterns or NPCs, addressed by the id in its body.
 *
 * One read on `by_owner_app_id` for every row written since that column
 * existed. A row written *before* it has no `appId`, so the fallback reads the
 * owner's rows that lack one — and only those, which is an empty range once
 * `maintenance.backfillBodyAppIds` has run — and matches the body instead.
 */
export async function findOwnedByAppId(
  ctx: QueryCtx | MutationCtx,
  table: BodyIdTable,
  ownerId: Id<'users'>,
  appId: string
): Promise<Doc<BodyIdTable> | null> {
  // Spelled out per table: `withIndex` cannot be typed over a union of tables,
  // even two whose index is declared identically.
  const byKey = (key: string | undefined) =>
    table === 'mechPatterns'
      ? ctx.db
          .query('mechPatterns')
          .withIndex('by_owner_app_id', (q) => q.eq('ownerId', ownerId).eq('appId', key))
      : ctx.db
          .query('encounterNpcs')
          .withIndex('by_owner_app_id', (q) => q.eq('ownerId', ownerId).eq('appId', key))

  const indexed = await byKey(appId).first()
  if (indexed !== null) return indexed

  const legacy: Doc<BodyIdTable>[] = await byKey(undefined).collect()
  return legacy.find((row) => bodyAppId(row.body) === appId) ?? null
}

/* -------------------------------------------------------------------------- */
/* Game summaries                                                             */
/* -------------------------------------------------------------------------- */

/** What the Games list shows for a table. Stored on `games.summary`. */
export type GameSummaryFields = NonNullable<Doc<'games'>['summary']>

/**
 * A crawler's display name, read defensively.
 *
 * The name lives in the opaque body Convex cannot validate (ADR-030), so the
 * shape is not trusted — the same move `crew.vitals` makes for pilot and mech
 * names.
 */
function crawlerNameOf(body: unknown): string | null {
  const name = (body as Record<string, unknown> | null | undefined)?.name
  return typeof name === 'string' && name.length > 0 ? name : null
}

/**
 * Count a Game from its rows.
 *
 * Convex has no count API, so each count is a `by_game` scan whose rows are
 * then discarded. That is the cost `games.summary` exists to take off the read
 * path: it is paid here, inside the mutation that changed the roster, rather
 * than by every subscriber of `games.listMine` on every write to any sheet.
 */
export async function computeGameSummary(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'>
): Promise<GameSummaryFields> {
  const [members, pilots, mechs, crawler] = await Promise.all([
    ctx.db
      .query('memberships')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect(),
    ctx.db
      .query('pilots')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect(),
    ctx.db
      .query('mechs')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect(),
    ctx.db
      .query('crawlers')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .first(),
  ])
  return {
    memberCount: members.length,
    pilotCount: pilots.length,
    mechCount: mechs.length,
    crawlerName: crawler === null ? null : crawlerNameOf(crawler.body),
  }
}

/**
 * A Game's summary: the stored one, or a live count for a row that predates
 * the column. The fallback is the old cost, paid only until the row is
 * backfilled or next refreshed.
 */
export async function summaryOf(
  ctx: QueryCtx | MutationCtx,
  game: Doc<'games'>
): Promise<GameSummaryFields> {
  return game.summary ?? (await computeGameSummary(ctx, game._id))
}

function sameSummary(a: GameSummaryFields | undefined, b: GameSummaryFields): boolean {
  return (
    a !== undefined &&
    a.memberCount === b.memberCount &&
    a.pilotCount === b.pilotCount &&
    a.mechCount === b.mechCount &&
    a.crawlerName === b.crawlerName
  )
}

/**
 * Recount a Game and store the result — but only write when it changed.
 *
 * The "only when changed" is the point: `games.listMine` subscribers re-run
 * when a `games` document is written, so an unconditional patch would
 * reintroduce exactly the churn the column removes. A Game that is gone (the
 * last step of `games.destroy` or an account deletion) has nothing to update.
 *
 * Returns whether it wrote, which is what the backfill counts.
 */
export async function refreshGameSummary(ctx: MutationCtx, gameId: Id<'games'>): Promise<boolean> {
  const game = await ctx.db.get(gameId)
  if (game === null) return false
  const next = await computeGameSummary(ctx, gameId)
  if (sameSummary(game.summary, next)) return false
  await ctx.db.patch(gameId, { summary: next })
  return true
}

/**
 * The Games a change to a row with a `gameId` affects, when it affects the
 * summary at all.
 *
 * Only arriving, leaving and moving count: an edit to a sheet that stays where
 * it is changes no count, so it costs nothing here — which is every HP tick.
 */
function containersTouched(
  oldGameId: Id<'games'> | null | undefined,
  newGameId: Id<'games'> | null | undefined,
  force: boolean
): Id<'games'>[] {
  if (!force && oldGameId === newGameId) return []
  const out: Id<'games'>[] = []
  if (oldGameId) out.push(oldGameId)
  if (newGameId && newGameId !== oldGameId) out.push(newGameId)
  return out
}

/**
 * Every write to a table the summary counts runs through here.
 *
 * Triggers rather than a `refreshGameSummary` call at each write site, because
 * there are about twenty of those spread over six modules — create, claim,
 * move, release, invite redemption, template seeding, Game and account
 * deletion — and one missed site would leave a badge quietly wrong forever.
 * A trigger cannot be forgotten by the next mutation, provided the mutation is
 * built with `mutation` / `internalMutation` from this module rather than from
 * `_generated/server`; `biome.jsonc` refuses the latter inside `convex/`.
 */
const triggers = new Triggers<DataModel>()

triggers.register('memberships', async (ctx, change) => {
  // Role flags change on update; membership counts change only on arrival or
  // departure.
  if (change.operation === 'update') return
  const gameId = (change.newDoc ?? change.oldDoc).gameId
  await refreshGameSummary(ctx, gameId)
})

for (const table of ['pilots', 'mechs'] as const) {
  triggers.register(table, async (ctx, change) => {
    const touched = containersTouched(
      change.oldDoc?.gameId,
      change.newDoc?.gameId,
      change.operation !== 'update'
    )
    for (const gameId of touched) await refreshGameSummary(ctx, gameId)
  })
}

triggers.register('crawlers', async (ctx, change) => {
  // A crawler also moves the summary when its name changes, since the list
  // shows it. Everything else about it — scrap, cargo, bays — does not.
  const renamed =
    change.operation === 'update' &&
    crawlerNameOf(change.oldDoc.body) !== crawlerNameOf(change.newDoc.body)
  const touched = containersTouched(
    change.oldDoc?.gameId,
    change.newDoc?.gameId,
    change.operation !== 'update' || renamed
  )
  for (const gameId of touched) await refreshGameSummary(ctx, gameId)
})

/**
 * The mutation builders every Convex module uses. Identical to the generated
 * ones except that database writes run the triggers above.
 */
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB))
export const internalMutation = customMutation(rawInternalMutation, customCtx(triggers.wrapDB))
