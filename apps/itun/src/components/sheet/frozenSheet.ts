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
import type { Crawler } from '../../lib/schemas/crawler'
import type { FrozenParse } from '../../lib/schemas/frozenEntity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { EntityType, useEntityStore } from '../../stores/entityStore'

export type { FrozenParse } from '../../lib/schemas/frozenEntity'
/**
 * Re-exported, not redefined. The parse moved to `lib/schemas/frozenEntity` so
 * the snapshot publish handler can share it without pulling `zustand` and the
 * entity store into the Cloudflare Worker bundle — see that module's header.
 * Rendering callers keep importing it from here, which is where they already
 * look for it.
 */
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
