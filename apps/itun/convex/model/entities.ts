import { EncounterNpcSchema } from '../../src/lib/schemas/encounterNpc'
import { MechSchema } from '../../src/lib/schemas/mech'
import { MechPatternSchema } from '../../src/lib/schemas/pattern'
import { PilotSchema } from '../../src/lib/schemas/pilot'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/**
 * Shared entity-document helpers for the mutation modules (ADR-030).
 *
 * Two obligations live here, and they are here because every one of those
 * modules owes them and each had grown its own copy.
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
