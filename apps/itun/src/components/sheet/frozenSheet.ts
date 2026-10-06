/**
 * The frozen-sheet path: render an entity nobody in this browser owns, without
 * writing it anywhere.
 *
 * ## Why this is a module rather than a prop on Sheet
 *
 * Two surfaces show a build read-only, and they arrive at it from different
 * directions: a crewmate's sheet on a Game roster (`GameEntitySheet`, ADR-030
 * §5) is a server row the viewer may read as a member but never write; a
 * public sheet (`PublicSheet`, `/p/$kind/$appId`, ADR-032) is the same kind of
 * row, read with no account at all. What they share is the mechanism — a
 * private, read-only Zustand store holding exactly one entity, threaded through
 * the same `Sheet` the live surfaces use — so the mechanism lives here and each
 * surface keeps its own framing.
 *
 * (There was a third consumer, the snapshot page at `/s/$id`. Snapshots were
 * retired — ADR-036 — and an old link now redirects to the public sheet.)
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
import type { Crawler } from '../../lib/schemas/crawler'
import type { FrozenParse } from '../../lib/schemas/frozenEntity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { EntityType, useEntityStore } from '../../stores/entityStore'

// Re-exported, not redefined. The parse lives in `lib/schemas/frozenEntity`
// (see that module's header for why it moved there). Rendering callers keep
// importing it from here, which is where they already look for it.
export type { FrozenParse } from '../../lib/schemas/frozenEntity'
export { parseFrozenEntity } from '../../lib/schemas/frozenEntity'

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
    // A frozen sheet is already fully in memory: there is nothing to load.
    hydrate: async () => undefined,
    rehydrate: async () => undefined,
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
