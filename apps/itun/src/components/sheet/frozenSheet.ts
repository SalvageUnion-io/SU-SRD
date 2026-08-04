/**
 * The frozen-sheet path: render an entity nobody in this browser owns, without
 * writing it anywhere.
 *
 * ## Why this is a module rather than a prop on Sheet
 *
 * Two surfaces need to show a build read-only, and they arrive at it from
 * opposite directions. A published snapshot (`/s/$id`, ADR-004) is a frozen
 * payload fetched from the snapshot Functions with no account behind it; a
 * crewmate's pilot on a Game roster (ADR-030 §5) is a live server row the
 * viewer may read but never write. What they share is the mechanism — a
 * private, read-only Zustand store holding exactly one entity, threaded through
 * the same `Sheet` the live surfaces use — so the mechanism lives here and each
 * surface keeps its own framing.
 *
 * ## The thing this deliberately does NOT do
 *
 * It never calls `entityStore.adopt`. Caching a crewmate's pilot into IndexedDB
 * to render it would put somebody else's character among the viewer's own
 * builds, under a container they do not control, with a local copy that goes
 * stale the moment its owner edits it — and `gameRoster.ts` already refuses to
 * hand out an editor whose writes the server rejects. Reading is not owning, so
 * a read leaves no trace.
 */

import { create } from 'zustand'

import { isRecord } from '../../lib/isRecord'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { CrawlerSchema } from '../../lib/schemas/crawler'
import { MechSchema } from '../../lib/schemas/mech'
import { PilotSchema, normalizeLegacyPilotRecord } from '../../lib/schemas/pilot'
import { normalizeLegacyCargoRecord } from '../../lib/schemas/cargoLot'
import type { EntityType, useEntityStore } from '../../stores/entityStore'

/** A parsed frozen entity, or the reason it could not be parsed. */
export type FrozenParse =
  | { ok: true; kind: 'pilot'; entity: Pilot }
  | { ok: true; kind: 'mech'; entity: Mech }
  | { ok: true; kind: 'crawler'; entity: Crawler }
  | { ok: false; reason: string }

/**
 * Validate an untrusted entity body against the schema for its kind.
 *
 * Untrusted in both callers, and for the same reason: a snapshot payload was
 * published by some other version of this app, and a server row was written by
 * some other player's browser. Neither is a record this session created, so
 * both go through Zod rather than a cast — a mismatch renders an explanation,
 * never a crash mid-sheet.
 */
export function parseFrozenEntity(kind: unknown, entity: unknown): FrozenParse {
  if (!isRecord(entity) || Array.isArray(entity)) {
    return { ok: false, reason: 'Entity data is missing or invalid.' }
  }

  if (kind === 'pilot') {
    // Records written before the vestigial `rollResults` removal still carry
    // the field — the same rewrite parseImportBundle applies.
    const parsed = PilotSchema.safeParse(normalizeLegacyPilotRecord(entity))
    return parsed.success
      ? { ok: true, kind: 'pilot', entity: parsed.data }
      : { ok: false, reason: `Invalid pilot data: ${parsed.error.message}` }
  }

  if (kind === 'mech') {
    // Records written before the cargo→cargoLots rename carry a legacy
    // `cargo: string[]` field — the same rewrite parseImportBundle applies.
    const parsed = MechSchema.safeParse(normalizeLegacyCargoRecord(entity))
    return parsed.success
      ? { ok: true, kind: 'mech', entity: parsed.data }
      : { ok: false, reason: `Invalid mech data: ${parsed.error.message}` }
  }

  if (kind === 'crawler') {
    const parsed = CrawlerSchema.safeParse(entity)
    return parsed.success
      ? { ok: true, kind: 'crawler', entity: parsed.data }
      : { ok: false, reason: `Invalid crawler data: ${parsed.error.message}` }
  }

  return { ok: false, reason: `Unknown entity kind: ${String(kind)}` }
}

type EntityState = ReturnType<typeof useEntityStore.getState>

/**
 * A read-only entity store containing ONLY the frozen entity. Reads serve the
 * one record; every write throws.
 *
 * The throws are unreachable in practice — `readOnly` suppresses every edit
 * affordance on the sheet — and that is exactly why they throw rather than
 * no-op: a silent no-op would let a future editing control look like it saved.
 */
export function makeFrozenStore(parsed: Extract<FrozenParse, { ok: true }>): typeof useEntityStore {
  const readOnlyWrite = async (): Promise<never> => {
    throw new Error('This sheet is read-only.')
  }

  const byType = (type: EntityType): Array<Pilot | Mech | Crawler> =>
    type === parsed.kind ? [parsed.entity] : []

  const state: EntityState = {
    pilots: parsed.kind === 'pilot' ? [parsed.entity] : [],
    mechs: parsed.kind === 'mech' ? [parsed.entity] : [],
    crawlers: parsed.kind === 'crawler' ? [parsed.entity] : [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
    hydrate: async () => {},
    rehydrate: async () => {},
    list: ((type: EntityType) => byType(type)) as EntityState['list'],
    get: ((type: EntityType, id: string) =>
      byType(type).find((e) => e.id === id) ?? null) as EntityState['get'],
    create: readOnlyWrite,
    // Adoption is a write like any other: this store exists precisely so that
    // reading somebody else's build does not put a copy of it anywhere.
    adopt: readOnlyWrite,
    forget: readOnlyWrite,
    update: readOnlyWrite,
    updateCrawlerBay: readOnlyWrite,
    delete: readOnlyWrite,
    transfer: readOnlyWrite,
  }

  return create<EntityState>(() => state)
}
