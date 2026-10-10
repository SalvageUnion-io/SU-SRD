/**
 * The read-only sheet store: render entities this browser does not hold — live,
 * through the same `<Sheet>` every editable surface uses — without writing them
 * anywhere.
 *
 * ## What feeds it
 *
 * A store built from whatever the server says right now, rebuilt each time it
 * says something new. Both sources are reactive Convex queries, so a sheet
 * rendered from one is current, not frozen:
 *
 *  - **A Game's listing** (`entities.listForGame`, via `sheetDataFromListing`):
 *    every pilot, mech and crawler in the Game and every link between them. The
 *    live sheet route (`SheetView`) renders a crewmate's pilot or mech from it,
 *    so their sheet resolves their mech, their crawler and the crawler's whole
 *    crew; and an editable sheet in a Game reads it as `others`, so your crawler
 *    lists crewmates' pilots it does not cache.
 *  - **A public sheet** (`publicSheet.get`, via `sheetDataFromPublic`): the
 *    published entity, its direct links, and the bodies of linked entities that
 *    are published themselves. The rest arrive as a kind alone and fill their
 *    slot as "Not shared" (`WithheldUnit`) — never named, never read.
 *
 * ## Why a store rather than a prop on Sheet
 *
 * `Sheet` and its views read through a store hook — composition, rail chips,
 * the Hold's docked mech — so a read-only rendering is a store whose reads
 * serve the server's answer and whose every write throws. Nothing downstream
 * needs to know it is not the real one.
 *
 * ## The thing this deliberately does NOT do
 *
 * It never calls `entityStore.adopt`. Caching a crewmate's pilot into IndexedDB
 * to render it would put somebody else's character among the viewer's own
 * builds, with a local copy that goes stale the moment its owner edits it and an
 * editor whose every save the server refuses (ADR-037: other members' pilots
 * and mechs are read live, never cached). Reading is not owning, so a read
 * leaves no trace.
 */

import { create } from 'zustand'
import type { ServerCrawler, ServerOwnable } from '../../lib/games/gameRoster'
import type { ServedLink } from '../../lib/links/linkSync'
import { softLinkFromServer } from '../../lib/links/linkSync'
import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import { parseFrozenEntity } from '../../lib/schemas/frozenEntity'
import type { Mech } from '../../lib/schemas/mech'
import type { Npc } from '../../lib/schemas/npc'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLink } from '../../lib/schemas/softLink'
import type { EntityState, EntityType, useEntityStore } from '../../stores/entityStore'
import type { WithheldUnit } from './sheetViewProps'

/** Everything a read-only sheet can resolve: bodies by kind, and the links between them. */
export type ReadOnlySheetData = {
  pilots: Pilot[]
  mechs: Mech[]
  crawlers: Crawler[]
  /** Built NPCs (ADR-043): a crawler's crew slot may name another member's. */
  npcs: Npc[]
  softLinks: SoftLink[]
}

/** A Game as `entities.listForGame` returns it, as far as a sheet reads it. */
export type GameListing = {
  pilots: readonly ServerOwnable[]
  mechs: readonly ServerOwnable[]
  crawlers: readonly ServerCrawler[]
  npcs: readonly ServerOwnable[]
  softLinks: readonly ServedLink[]
}

/** `publicSheet.get`'s answer, as far as a sheet reads it. */
export type PublicSheetAnswer = {
  kind: string
  body: unknown
  links: ReadonlyArray<Pick<SoftLink, 'type' | 'from' | 'to'>>
  linked: ReadonlyArray<{ kind: EntityRef['type']; id: string; name: string; body: unknown }>
  withheld: ReadonlyArray<{ kind: EntityRef['type'] }>
}

/** A body parsed and filed under the id links address it by. */
type Parsed =
  | { kind: 'pilot'; entity: Pilot }
  | { kind: 'mech'; entity: Mech }
  | { kind: 'crawler'; entity: Crawler }
  | { kind: 'npc'; entity: Npc }

/**
 * Parse one server body, filed under `id`.
 *
 * `id` is the row's app id where it has one: that is what links and URLs
 * address, and a template-seeded row (no app id) falls back to its body's.
 * A body that does not parse comes back `null` — a crewmate's build saved by a
 * newer or older app. The sheet FOR that entity says so itself
 * (`SheetView`); everywhere else it simply does not resolve, which is how a
 * stale link to a missing entity already renders.
 */
function parseAs(kind: EntityRef['type'], body: unknown, id: string | null): Parsed | null {
  const parsed = parseFrozenEntity(kind, body)
  if (!parsed.ok) return null
  switch (parsed.kind) {
    case 'pilot':
      return { kind: 'pilot', entity: { ...parsed.entity, id: id ?? parsed.entity.id } }
    case 'mech':
      return { kind: 'mech', entity: { ...parsed.entity, id: id ?? parsed.entity.id } }
    case 'crawler':
      return { kind: 'crawler', entity: { ...parsed.entity, id: id ?? parsed.entity.id } }
    case 'npc':
      return { kind: 'npc', entity: { ...parsed.entity, id: id ?? parsed.entity.id } }
  }
}

function file(data: ReadOnlySheetData, parsed: Parsed | null): void {
  if (parsed === null) return
  if (parsed.kind === 'pilot') data.pilots.push(parsed.entity)
  else if (parsed.kind === 'mech') data.mechs.push(parsed.entity)
  else if (parsed.kind === 'npc') data.npcs.push(parsed.entity)
  else data.crawlers.push(parsed.entity)
}

function emptyData(): ReadOnlySheetData {
  return { pilots: [], mechs: [], crawlers: [], npcs: [], softLinks: [] }
}

/** Everything a Game holds, as a read-only sheet resolves it. */
export function sheetDataFromListing(listing: GameListing): ReadOnlySheetData {
  const data = emptyData()
  for (const row of listing.pilots) file(data, parseAs('pilot', row.body, row.appId))
  for (const row of listing.mechs) file(data, parseAs('mech', row.body, row.appId))
  for (const row of listing.crawlers) file(data, parseAs('crawler', row.body, row.appId))
  for (const row of listing.npcs) file(data, parseAs('npc', row.body, row.appId))
  data.softLinks = listing.softLinks.map(softLinkFromServer)
  return data
}

/**
 * A public sheet's store data, and the slots it may only mark as filled.
 *
 * The published entity itself is filed under `appId`, and each published linked
 * entity beside it, so the rail shows it with its vitals. The unpublished ones
 * arrive as a kind and nothing more, and become `withheld` — "Not shared" in
 * their slot. Links have no id on this wire (a link is its type and its two
 * ends), so each gets one spelled from exactly that.
 */
export function sheetDataFromPublic(
  answer: PublicSheetAnswer,
  appId: string
): { data: ReadOnlySheetData; withheld: WithheldUnit[]; published: ReadonlySet<string> } {
  const data = emptyData()
  if (answer.kind === 'pilot' || answer.kind === 'mech' || answer.kind === 'crawler') {
    file(data, parseAs(answer.kind, answer.body, appId))
  }
  const withheld: WithheldUnit[] = answer.withheld.map((unit, i) => ({
    key: `withheld-${unit.kind}-${i}`,
    kind: unit.kind,
  }))
  const published = new Set<string>([appId])
  for (const unit of answer.linked) {
    const parsed = parseAs(unit.kind, unit.body, unit.id)
    if (parsed === null) {
      // Published, so it may be named — but not drawn from a body this app
      // cannot read.
      withheld.push({ key: `${unit.kind}:${unit.id}`, kind: unit.kind, name: unit.name })
    } else {
      file(data, parsed)
      published.add(unit.id)
    }
  }
  data.softLinks = answer.links.map((link) => ({
    id: `${link.type}:${link.from.id}:${link.to.id}`,
    type: link.type,
    from: { type: link.from.type, id: link.from.id },
    to: { type: link.to.type, id: link.to.id },
    createdAt: new Date(0).toISOString(),
  }))
  return { data, withheld, published }
}

/**
 * A read-only entity store over `data`. Reads serve it; every write throws.
 *
 * The throws are unreachable in practice — `readOnly` suppresses every edit
 * affordance on the sheet — and that is exactly why they throw rather than
 * no-op: a silent no-op would let a future editing control look like it saved.
 */
export function makeReadOnlySheetStore(data: ReadOnlySheetData): typeof useEntityStore {
  const readOnlyWrite = async (): Promise<never> => {
    throw new Error('This sheet is read-only.')
  }

  const byType = (type: EntityType): ReadonlyArray<Pilot | Mech | Crawler | Npc | SoftLink> =>
    type === 'pilot'
      ? data.pilots
      : type === 'mech'
        ? data.mechs
        : type === 'crawler'
          ? data.crawlers
          : type === 'npc'
            ? data.npcs
            : data.softLinks

  const state: EntityState = {
    pilots: data.pilots,
    mechs: data.mechs,
    crawlers: data.crawlers,
    npcs: data.npcs,
    softLinks: data.softLinks,
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
    // Already fully in memory: there is nothing to load.
    hydrate: async () => undefined,
    rehydrate: async () => undefined,
    list: ((type: EntityType) => [...byType(type)]) as EntityState['list'],
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
