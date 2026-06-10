import * as db from '../db/index'
import type { ExportBundle } from '../schemas/exportBundle'
import type { MechPattern } from '../schemas/pattern'
import type { EntityType } from '../../stores/types'

/**
 * Minimal create-only store interface required by mergeImport.
 * The real entityStore and workspaceStore both satisfy this.
 */
type MergeEntityStore = {
  hydrate: (type: EntityType) => Promise<void>
  list: <T extends EntityType>(type: T) => import('../../stores/types').EntityForType<T>[]
  create: <T extends EntityType>(
    type: T,
    input: import('../../stores/types').CreateInput<T>
  ) => Promise<import('../../stores/types').EntityForType<T>>
}

type MergeWorkspaceStore = {
  hydrate: () => Promise<void>
  list: () => import('../schemas/workspace').Workspace[]
  create: (input: { name: string }) => Promise<import('../schemas/workspace').Workspace>
}

/**
 * Minimal pattern store for import. Patterns are not in entityStore — they
 * default to the db layer; tests may pass a double.
 */
type MergePatternStore = {
  list: () => Promise<MechPattern[]>
  create: (input: Omit<MechPattern, 'id' | 'createdAt'>) => Promise<MechPattern>
}

export type MergeSummary = {
  created: {
    pilots: number
    mechs: number
    crawlers: number
    workspaces: number
    softLinks: number
    mechPatterns: number
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
 *   4. Remap:
 *        - softLink.from.id / softLink.to.id through the map.
 *        - pilot/mech/crawler.workspaceId through the map.
 *   5. Create each remapped entity via store.create() (NEVER overwrite).
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
  workspaceStore: MergeWorkspaceStore,
  patternStore: MergePatternStore = db.mechPatterns
): Promise<MergeSummary> {
  // Hydrate so we can check for existing ids.
  await Promise.all([
    entityStore.hydrate('pilot'),
    entityStore.hydrate('mech'),
    entityStore.hydrate('crawler'),
    entityStore.hydrate('softLink'),
    workspaceStore.hydrate(),
  ])

  const existingPilotIds = new Set(entityStore.list('pilot').map((e) => e.id))
  const existingMechIds = new Set(entityStore.list('mech').map((e) => e.id))
  const existingCrawlerIds = new Set(entityStore.list('crawler').map((e) => e.id))
  const existingWorkspaceIds = new Set(workspaceStore.list().map((w) => w.id))
  const existingSoftLinkIds = new Set(entityStore.list('softLink').map((l) => l.id))

  /** old id → new id for every entity that will be created */
  const idMap = new Map<string, string>()

  const summary: MergeSummary = {
    created: {
      pilots: 0,
      mechs: 0,
      crawlers: 0,
      workspaces: 0,
      softLinks: 0,
      mechPatterns: 0,
    },
    remappedLinks: 0,
    skippedDuplicates: 0,
  }

  // -------------------------------------------------------------------------
  // 1. Workspaces — remap first so entity workspaceId refs can be remapped.
  // -------------------------------------------------------------------------
  for (const ws of bundle.workspaces) {
    if (existingWorkspaceIds.has(ws.id)) {
      summary.skippedDuplicates++
      // Map old id → existing id so downstream refs stay valid.
      idMap.set(ws.id, ws.id)
      continue
    }
    const newWs = await workspaceStore.create({ name: ws.name })
    idMap.set(ws.id, newWs.id)
    summary.created.workspaces++
  }

  // -------------------------------------------------------------------------
  // 2. Pilots
  // -------------------------------------------------------------------------
  for (const pilot of bundle.entities.pilots) {
    if (existingPilotIds.has(pilot.id)) {
      summary.skippedDuplicates++
      idMap.set(pilot.id, pilot.id)
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, workspaceId, ...rest } = pilot
    const remappedWorkspaceId =
      workspaceId !== undefined ? (idMap.get(workspaceId) ?? undefined) : undefined

    const created = await entityStore.create('pilot', {
      ...rest,
      ...(remappedWorkspaceId !== undefined ? { workspaceId: remappedWorkspaceId } : {}),
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
    const { id: _id, createdAt: _ca, updatedAt: _ua, workspaceId, ...rest } = mech
    const remappedWorkspaceId =
      workspaceId !== undefined ? (idMap.get(workspaceId) ?? undefined) : undefined

    const created = await entityStore.create('mech', {
      ...rest,
      ...(remappedWorkspaceId !== undefined ? { workspaceId: remappedWorkspaceId } : {}),
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
    const { id: _id, createdAt: _ca, updatedAt: _ua, workspaceId, ...rest } = crawler
    const remappedWorkspaceId =
      workspaceId !== undefined ? (idMap.get(workspaceId) ?? undefined) : undefined

    const created = await entityStore.create('crawler', {
      ...rest,
      ...(remappedWorkspaceId !== undefined ? { workspaceId: remappedWorkspaceId } : {}),
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
  const existingPatternIds = new Set((await patternStore.list()).map((p) => p.id))
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

  return summary
}
