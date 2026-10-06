import { customCtx, customMutation } from 'convex-helpers/server/customFunctions'
import { Triggers } from 'convex-helpers/server/triggers'
import type { LinkShape } from '../../src/lib/links/linkRules'
import { conflictingLinks, LINK_ENDS, sameLink } from '../../src/lib/links/linkRules'
import { CrawlerSchema } from '../../src/lib/schemas/crawler'
import { EncounterNpcSchema } from '../../src/lib/schemas/encounterNpc'
import { MechSchema } from '../../src/lib/schemas/mech'
import { MechPatternSchema } from '../../src/lib/schemas/pattern'
import { StoredPilotSchema } from '../../src/lib/schemas/pilot'
import type { SoftLink } from '../../src/lib/schemas/softLink'
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
  // Behind the legacy normaliser: a pilot row stored before a field was
  // removed from the schema (`equipmentLoadouts`, `rollResults`) must still
  // validate when it is read back and re-parsed, not reject every write to it.
  pilots: StoredPilotSchema,
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
 * Remove the named fields from a crawler body, refusing any name the crawler
 * schema does not define.
 *
 * The other half of `patchCrawlerByAppId`'s `unset`: a field patch cannot clear
 * a field by sending `undefined`, because the Convex client drops undefined
 * object fields on the wire. Only names the schema knows are accepted, so this
 * cannot be used to strip arbitrary keys; whether a removal leaves a valid body
 * (it cannot drop a required field) is still `parseBody`'s call.
 */
export function unsetCrawlerFields(
  body: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const next = { ...body }
  for (const key of keys) {
    if (!Object.hasOwn(CrawlerSchema.shape, key)) {
      throw new Error(`Invalid crawlers patch: cannot unset unknown field "${key}"`)
    }
    delete next[key]
  }
  return next
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
 * One of the owner's own patterns or NPCs, addressed by the id in its body:
 * one read on `by_owner_app_id`.
 */
export async function findOwnedByAppId(
  ctx: QueryCtx | MutationCtx,
  table: BodyIdTable,
  ownerId: Id<'users'>,
  appId: string
): Promise<Doc<BodyIdTable> | null> {
  // Spelled out per table: `withIndex` cannot be typed over a union of tables,
  // even two whose index is declared identically.
  return table === 'mechPatterns'
    ? await ctx.db
        .query('mechPatterns')
        .withIndex('by_owner_app_id', (q) => q.eq('ownerId', ownerId).eq('appId', appId))
        .first()
    : await ctx.db
        .query('encounterNpcs')
        .withIndex('by_owner_app_id', (q) => q.eq('ownerId', ownerId).eq('appId', appId))
        .first()
}

/**
 * The server row for a soft link, addressed the way the client addresses one.
 *
 * Soft links carry no `appId` and need none: `from.id` and `to.id` already ARE
 * app-level ids, so the (from, to, kind) triple is the link's identity. Two
 * links with the same endpoints and the same kind are the same link, whichever
 * browser drew it — which is what makes the mirror idempotent for free.
 *
 * Shared by the mirror mutations (`entities.ts`) and the claim (`claim.ts`):
 * the triple is the link's identity in both places, and two copies of that
 * rule could disagree.
 */
export async function findSoftLink(
  ctx: MutationCtx,
  fromId: string,
  toId: string,
  type: SoftLink['type']
): Promise<Doc<'softLinks'> | null> {
  const candidates = await ctx.db
    .query('softLinks')
    .withIndex('by_from', (q) => q.eq('from.id', fromId))
    .collect()

  return candidates.find((l) => l.to.id === toId && l.type === type) ?? null
}

/* -------------------------------------------------------------------------- */
/* The assignment model (ADR-037)                                             */
/* -------------------------------------------------------------------------- */

/** A row that sits in a container: every table a link end can name. */
export type ContainedRow = Doc<'pilots'> | Doc<'mechs'> | Doc<'crawlers'>

/** Which table each link-end kind lives in. */
const TABLE_FOR_END = { pilot: 'pilots', mech: 'mechs', crawler: 'crawlers' } as const

/**
 * The id links use for a row: its `appId`, or — for a row seeded server-side
 * by a template, which has none — the id inside its body, which is what the
 * template's own links were written against.
 */
export function linkIdOf(row: ContainedRow): string | undefined {
  return row.appId ?? bodyAppId(row.body)
}

/** A row's owner. Absent on a crawler that has never been shelved, which means null. */
function ownerOfRow(row: ContainedRow): Id<'users'> | null {
  return row.ownerId ?? null
}

/**
 * Whether two rows are in the same container — the one assignment invariant
 * that is about *where*, not *how many*.
 *
 * The same Game, or the same owner's shelf. The second clause is the one
 * `lib/container.ts`'s `sameContainer` cannot express: every player's shelf has
 * the same `null` game id, and "My stuff" is a solo Game per person, not one
 * shared bucket. A shelf row with no owner is the invalid row (ADR-030 §2), so
 * it shares a container with nothing.
 */
export function sameContainerRows(a: ContainedRow, b: ContainedRow): boolean {
  if (a.gameId !== b.gameId) return false
  if (a.gameId !== null) return true
  const owner = ownerOfRow(a)
  return owner !== null && owner === ownerOfRow(b)
}

async function rowsByAppId(
  ctx: QueryCtx | MutationCtx,
  type: LinkShape['from']['type'],
  appId: string
): Promise<ContainedRow[]> {
  // Spelled out per table: `withIndex` cannot be typed over a union of tables.
  if (type === 'pilot') {
    return await ctx.db
      .query('pilots')
      .withIndex('by_app_id', (q) => q.eq('appId', appId))
      .collect()
  }
  if (type === 'mech') {
    return await ctx.db
      .query('mechs')
      .withIndex('by_app_id', (q) => q.eq('appId', appId))
      .collect()
  }
  return await ctx.db
    .query('crawlers')
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .collect()
}

/** Every row of one kind in a Game. */
export async function rowsInGame(
  ctx: QueryCtx | MutationCtx,
  type: LinkShape['from']['type'],
  gameId: Id<'games'>
): Promise<ContainedRow[]> {
  const table = TABLE_FOR_END[type]
  if (table === 'pilots') {
    return await ctx.db
      .query('pilots')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect()
  }
  if (table === 'mechs') {
    return await ctx.db
      .query('mechs')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect()
  }
  return await ctx.db
    .query('crawlers')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .collect()
}

/**
 * The row a link end names, or null when there is none.
 *
 * Addressed by `appId`, resolving a duplicate to the oldest row exactly as
 * `byAppId` does in `entities.ts`. When nothing carries that app id and a Game
 * is named, the Game's own rows are searched for one with **no** `appId` whose
 * body id matches: a template seeds its crew without app ids, and its links
 * point at body ids, so without this a template's crawler could never be
 * assigned to. Scoped to one Game because template body ids repeat across
 * every Game seeded from the same template.
 */
export async function resolveLinkEnd(
  ctx: QueryCtx | MutationCtx,
  ref: { type: LinkShape['from']['type']; id: string },
  gameHint: Id<'games'> | null
): Promise<ContainedRow | null> {
  const matches = await rowsByAppId(ctx, ref.type, ref.id)
  if (matches.length > 0) {
    return matches.reduce((oldest, row) =>
      row._creationTime < oldest._creationTime ? row : oldest
    )
  }
  if (gameHint === null) return null
  const seeded = await rowsInGame(ctx, ref.type, gameHint)
  return seeded.find((row) => row.appId === undefined && bodyAppId(row.body) === ref.id) ?? null
}

/** Every link with this id on either end. */
export async function linksTouching(
  ctx: QueryCtx | MutationCtx,
  id: string
): Promise<Doc<'softLinks'>[]> {
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query('softLinks')
      .withIndex('by_from', (q) => q.eq('from.id', id))
      .collect(),
    ctx.db
      .query('softLinks')
      .withIndex('by_to', (q) => q.eq('to.id', id))
      .collect(),
  ])
  const seen = new Set<string>()
  return [...outgoing, ...incoming].filter((l) => {
    if (seen.has(l._id)) return false
    seen.add(l._id)
    return true
  })
}

/**
 * Draw a link, replacing every link it conflicts with, in this one mutation.
 *
 * The cardinality invariant's single server-side writer: `upsertSoftLink`, the
 * claim, and the primary-crawler auto-assignment all draw through here, so
 * "a pilot crews one crawler" cannot hold on one path and not another. The
 * rule itself is `conflictingLinks` (`src/lib/links/linkRules.ts`), shared with
 * the client.
 *
 * The caller has already decided the link is allowed — who may draw it, and
 * that both ends share `gameId`'s container. `mayReplace` is asked about each
 * conflicting link before anything is written, so a refusal there leaves the
 * table exactly as it was; omit it for a server-internal write.
 *
 * ## Which neighbours count
 *
 * Conflicts on the `to` end (a pilot flies one mech) are looked for only among
 * links filed in the same container, and so are the `from` end's when
 * `fromScope` is `'container'`. Both exist for template-seeded rows: they carry
 * no `appId`, their links name body ids, and those ids repeat across every
 * Game seeded from the same template — a pilot in another Game is not this
 * pilot. A `from` end found by `appId` is unique, so its links count wherever
 * they are filed (`'any'`, the default), which also catches a link a pre-ADR-037
 * move left filed under the wrong container.
 */
export async function writeSoftLink(
  ctx: MutationCtx,
  link: LinkShape,
  gameId: Id<'games'> | null,
  options: {
    fromScope?: 'any' | 'container'
    mayReplace?: (conflict: Doc<'softLinks'>) => Promise<void>
  } = {}
): Promise<'inserted' | 'present'> {
  const [allFrom, toSide] = await Promise.all([
    ctx.db
      .query('softLinks')
      .withIndex('by_from', (q) => q.eq('from.id', link.from.id))
      .collect(),
    LINK_ENDS[link.type].exclusiveTo
      ? ctx.db
          .query('softLinks')
          .withIndex('by_to', (q) => q.eq('to.id', link.to.id))
          .collect()
      : Promise.resolve([]),
  ])
  const fromSide =
    options.fromScope === 'container' ? allFrom.filter((l) => l.gameId === gameId) : allFrom
  const mayReplace = options.mayReplace
  const candidates = [...fromSide, ...toSide.filter((l) => l.gameId === gameId)]
  const seen = new Set<string>()
  const conflicts = conflictingLinks(candidates, link).filter((l) => {
    if (seen.has(l._id)) return false
    seen.add(l._id)
    return true
  })

  if (mayReplace !== undefined) {
    for (const conflict of conflicts) await mayReplace(conflict)
  }
  for (const conflict of conflicts) await ctx.db.delete(conflict._id)

  const existing = fromSide.find((l) => sameLink(l, link))
  if (existing !== undefined) {
    // Already drawn; only its container can have drifted, and it follows its ends.
    if (existing.gameId !== gameId) await ctx.db.patch(existing._id, { gameId })
    return 'present'
  }
  await ctx.db.insert('softLinks', {
    gameId,
    from: { type: link.from.type, id: link.from.id },
    to: { type: link.to.type, id: link.to.id },
    type: link.type,
  })
  return 'inserted'
}

/**
 * Delete every link touching a row that is being destroyed.
 *
 * Scoped to the row's own Game when it is template-seeded (no `appId`), for
 * the reason `writeSoftLink` gives: its body id is shared with its twin in
 * every other Game seeded from the same template, whose links are not this
 * row's to delete.
 */
export async function pruneLinksOfRow(ctx: MutationCtx, row: ContainedRow): Promise<void> {
  const id = linkIdOf(row)
  if (id === undefined) return
  for (const link of await linksTouching(ctx, id)) {
    if (row.appId === undefined && link.gameId !== row.gameId) continue
    await ctx.db.delete(link._id)
  }
}

/**
 * After a row changes container, drop every link that now straddles two, and
 * re-file the ones that came along.
 *
 * A link survives only when its other end is in the row's NEW container; one
 * whose other end is elsewhere, or no longer exists, is deleted. Called from
 * every move path (`upsertByAppId`, the crawler move) so that "both ends share
 * a container" survives the move as well as the draw. The client mirrors it in
 * `entityStore.update` through `linksBrokenByMove`.
 *
 * `previousGameId` scopes a template-seeded row (no `appId`) to the links
 * filed where it came from, because its body id is shared with its twin in
 * every other Game seeded from the same template (see `writeSoftLink`).
 */
export async function pruneLinksAcrossContainers(
  ctx: MutationCtx,
  row: ContainedRow,
  previousGameId: Id<'games'> | null
): Promise<void> {
  const id = linkIdOf(row)
  if (id === undefined) return
  const touching = await linksTouching(ctx, id)
  const own =
    row.appId === undefined ? touching.filter((l) => l.gameId === previousGameId) : touching
  for (const link of own) {
    const other = link.from.id === id ? link.to : link.from
    const otherRow = await resolveLinkEnd(ctx, other, row.gameId)
    if (otherRow === null || !sameContainerRows(row, otherRow)) {
      await ctx.db.delete(link._id)
    } else if (link.gameId !== row.gameId) {
      await ctx.db.patch(link._id, { gameId: row.gameId })
    }
  }
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
 * A Game's summary: the stored one, or a live count for a row that has none
 * (one written without the triggers, e.g. from the dashboard).
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
 */
export async function refreshGameSummary(ctx: MutationCtx, gameId: Id<'games'>): Promise<void> {
  const game = await ctx.db.get(gameId)
  if (game === null) return
  const next = await computeGameSummary(ctx, gameId)
  if (sameSummary(game.summary, next)) return
  await ctx.db.patch(gameId, { summary: next })
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
