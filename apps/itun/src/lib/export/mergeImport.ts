import type { EncounterNpcCreateInput } from '../../stores/encounterStore'
import { useEncounterStore } from '../../stores/encounterStore'
import type { MechPatternCreateInput } from '../../stores/patternStore'
import { usePatternStore } from '../../stores/patternStore'
import type { EntityType } from '../../stores/types'
import type { EncounterNpc } from '../schemas/encounterNpc'
import type { ExportBundle } from '../schemas/exportBundle'
import type { MechPattern } from '../schemas/pattern'

/**
 * Minimal create-only store interface required by mergeImport.
 * The real entityStore satisfies this.
 */
type MergeEntityStore = {
  hydrate: (type: EntityType) => Promise<void>
  list: <T extends EntityType>(type: T) => import('../../stores/types').EntityForType<T>[]
  create: <T extends EntityType>(
    type: T,
    input: import('../../stores/types').CreateInput<T>
  ) => Promise<import('../../stores/types').EntityForType<T>>
}

/**
 * Minimal pattern store for import. Patterns are not in entityStore — they have
 * their own Zustand store; tests may pass a double.
 *
 * `rehydrate` is part of the contract, not a convenience. These stores list
 * synchronously from memory, so deduping against a cold cache would let an
 * import create a second copy of every pattern the user already has. It has to
 * be `rehydrate` rather than `hydrate`: `hydrate` is idempotent and returns
 * immediately once the store has ever loaded, which would dedupe against a
 * cache that another tab's writes have since moved on from. An import is
 * exactly when a stale read is expensive, so it re-reads from IndexedDB.
 */
type MergePatternStore = {
  rehydrate: () => Promise<void>
  list: () => MechPattern[]
  create: (input: MechPatternCreateInput) => Promise<MechPattern>
}

/**
 * Minimal encounter-NPC store for import. Like patterns, encounterNpcs are not
 * in entityStore but have their own store; tests may pass a double. Same
 * rehydrate-before-list contract as above.
 */
type MergeEncounterNpcStore = {
  rehydrate: () => Promise<void>
  list: () => EncounterNpc[]
  create: (input: EncounterNpcCreateInput) => Promise<EncounterNpc>
}

export type MergeSummary = {
  created: {
    pilots: number
    mechs: number
    crawlers: number
    softLinks: number
    mechPatterns: number
    encounterNpcs: number
  }
  remappedLinks: number
  skippedDuplicates: number
}

/**
 * mergeImport — import an ExportBundle into the local store.
 *
 * Strategy:
 *   1. Hydrate current store state so we know which ids already exist.
 *   2. Assign FRESH UUIDs to every entity in the bundle.
 *   3. Build an old-id → new-id map.
 *   4. Remap softLink.from.id / softLink.to.id through the map.
 *   5. Create each remapped entity via store.create() (NEVER overwrite).
 *
 * Every imported entity lands on the importer's **Shelf** (ADR-030 §2).
 * Game membership is granted by the server, not carried in a file, so a bundle
 * naming a Game the importer does not belong to would otherwise drop its
 * entities into a container they can never open. This is the same instinct the
 * old workspace remapping had — drop references that mean nothing here — with
 * the Shelf as the one container every account is guaranteed to have.
 *
 * Entities whose old id already exists in the store are skipped (counted in
 * skippedDuplicates). Soft links that reference an id not present in the
 * id-map (because the endpoint was skipped or absent from the bundle) are
 * also skipped to avoid dangling refs.
 *
 * Returns a MergeSummary with created counts and remap stats.
 */
export async function mergeImport(
  bundle: ExportBundle,
  entityStore: MergeEntityStore,
  // Patterns and encounter NPCs go through their stores, not `db.*`. Writing
  // straight to the db layer is the exact bypass patternStore was created to
  // end: those writes never reached the backup nudge and never published the
  // cross-tab broadcast, so an import left every other tab — and the importing
  // tab's own caches, which get no self-echo — showing the pre-import lists
  // until a reload. Pilots/mechs/crawlers below already went through their
  // store; these two were the holdouts.
  patternStore: MergePatternStore = usePatternStore.getState(),
  encounterNpcStore: MergeEncounterNpcStore = useEncounterStore.getState()
): Promise<MergeSummary> {
  // Hydrate so we can check for existing ids.
  await Promise.all([
    entityStore.hydrate('pilot'),
    entityStore.hydrate('mech'),
    entityStore.hydrate('crawler'),
    entityStore.hydrate('softLink'),
  ])

  const existingPilotIds = new Set(entityStore.list('pilot').map((e) => e.id))
  const existingMechIds = new Set(entityStore.list('mech').map((e) => e.id))
  const existingCrawlerIds = new Set(entityStore.list('crawler').map((e) => e.id))
  const existingSoftLinkIds = new Set(entityStore.list('softLink').map((l) => l.id))

  /** old id → new id for every entity that will be created */
  const idMap = new Map<string, string>()

  const summary: MergeSummary = {
    created: {
      pilots: 0,
      mechs: 0,
      crawlers: 0,
      softLinks: 0,
      mechPatterns: 0,
      encounterNpcs: 0,
    },
    remappedLinks: 0,
    skippedDuplicates: 0,
  }

  // -------------------------------------------------------------------------
  // 1. Pilots
  // -------------------------------------------------------------------------
  for (const pilot of bundle.entities.pilots) {
    if (existingPilotIds.has(pilot.id)) {
      summary.skippedDuplicates++
      idMap.set(pilot.id, pilot.id)
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, workspaceId: _ws, gameId: _g, ...rest } = pilot

    const created = await entityStore.create('pilot', {
      ...rest,
      gameId: null,
    })
    idMap.set(pilot.id, created.id)
    summary.created.pilots++
  }

  // -------------------------------------------------------------------------
  // 3. Mechs
  // -------------------------------------------------------------------------
  for (const mech of bundle.entities.mechs) {
    if (existingMechIds.has(mech.id)) {
      summary.skippedDuplicates++
      idMap.set(mech.id, mech.id)
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, workspaceId: _ws, gameId: _g, ...rest } = mech

    const created = await entityStore.create('mech', {
      ...rest,
      gameId: null,
    })
    idMap.set(mech.id, created.id)
    summary.created.mechs++
  }

  // -------------------------------------------------------------------------
  // 4. Crawlers
  // -------------------------------------------------------------------------
  for (const crawler of bundle.entities.crawlers) {
    if (existingCrawlerIds.has(crawler.id)) {
      summary.skippedDuplicates++
      idMap.set(crawler.id, crawler.id)
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
      id: _id,
      createdAt: _ca,
      updatedAt: _ua,
      workspaceId: _ws,
      gameId: _g,
      ...rest
    } = crawler

    const created = await entityStore.create('crawler', {
      ...rest,
      gameId: null,
    })
    idMap.set(crawler.id, created.id)
    summary.created.crawlers++
  }

  // -------------------------------------------------------------------------
  // 5. SoftLinks — remap from/to through idMap; skip if endpoint missing.
  // -------------------------------------------------------------------------
  for (const link of bundle.softLinks) {
    if (existingSoftLinkIds.has(link.id)) {
      summary.skippedDuplicates++
      continue
    }

    const newFromId = idMap.get(link.from.id)
    const newToId = idMap.get(link.to.id)

    if (newFromId === undefined || newToId === undefined) {
      // Endpoint not in the bundle or was skipped — skip link to avoid dangling ref.
      continue
    }

    const wasRemapped = newFromId !== link.from.id || newToId !== link.to.id
    if (wasRemapped) summary.remappedLinks++

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, ...rest } = link
    await entityStore.create('softLink', {
      ...rest,
      from: { ...link.from, id: newFromId },
      to: { ...link.to, id: newToId },
    })
    summary.created.softLinks++
  }

  // -------------------------------------------------------------------------
  // 6. Mech patterns — fresh UUIDs, exact-id dedupe (same policy as entities).
  //    Patterns reference no other bundle entities, so no remapping needed.
  // -------------------------------------------------------------------------
  await patternStore.rehydrate()
  const existingPatternIds = new Set(patternStore.list().map((p) => p.id))
  for (const pattern of bundle.mechPatterns) {
    if (existingPatternIds.has(pattern.id)) {
      summary.skippedDuplicates++
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, ...rest } = pattern
    await patternStore.create(rest)
    summary.created.mechPatterns++
  }

  // -------------------------------------------------------------------------
  // 7. Encounter NPCs — fresh UUIDs, exact-id dedupe (same policy as
  //    entities). Container handling matches pilot/mech/crawler: everything
  //    lands on the Shelf (dropped if the referenced container was not
  //    part of this bundle / not in the map).
  // -------------------------------------------------------------------------
  await encounterNpcStore.rehydrate()
  const existingEncounterNpcIds = new Set(encounterNpcStore.list().map((n) => n.id))
  for (const npc of bundle.encounterNpcs) {
    if (existingEncounterNpcIds.has(npc.id)) {
      summary.skippedDuplicates++
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, workspaceId: _ws, gameId: _g, ...rest } = npc

    await encounterNpcStore.create({
      ...rest,
      gameId: null,
    })
    summary.created.encounterNpcs++
  }

  return summary
}
