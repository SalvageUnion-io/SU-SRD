import type { ExportBundle } from '../schemas/exportBundle'
import type { EntityType } from '../../stores/types'

/**
 * Minimal store interface required by the build functions.
 * Accepts either the real Zustand entityStore or a test double.
 */
type ExportStore = {
  hydrate: (type: EntityType) => Promise<void>
  list: <T extends EntityType>(type: T) => import('../../stores/types').EntityForType<T>[]
}

/**
 * Minimal workspace store interface for export.
 */
type ExportWorkspaceStore = {
  hydrate: () => Promise<void>
  list: () => import('../schemas/workspace').Workspace[]
}

/**
 * buildExportBundle — full backup of all entities, workspaces, and softLinks.
 *
 * Hydrates every store type first so the caller does not need to pre-hydrate.
 * The returned bundle is a plain serialisable object — no IDB references.
 */
export async function buildExportBundle(
  entityStore: ExportStore,
  workspaceStore: ExportWorkspaceStore
): Promise<ExportBundle> {
  await Promise.all([
    entityStore.hydrate('pilot'),
    entityStore.hydrate('mech'),
    entityStore.hydrate('crawler'),
    entityStore.hydrate('softLink'),
    workspaceStore.hydrate(),
  ])

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    entities: {
      pilots: entityStore.list('pilot'),
      mechs: entityStore.list('mech'),
      crawlers: entityStore.list('crawler'),
    },
    workspaces: workspaceStore.list(),
    softLinks: entityStore.list('softLink'),
  }
}

/**
 * buildEntityExport — single entity + its directly-attached softLinks.
 *
 * Only the entity and links whose `from.id` or `to.id` matches the entity id
 * are included. Workspaces are intentionally omitted — the importing store
 * will already have its own workspace set, and mergeImport handles
 * workspaceId remapping by clearing references to unknown workspaces.
 *
 * Design note: we do NOT pull in the referenced endpoints (e.g. the mech
 * that a pilot-to-mech link points to). A single-entity export is intended
 * for "send this pilot to a friend" use-cases — the friend builds their own
 * mechs. Including deep transitive closure would make the export ambiguous.
 */
export async function buildEntityExport(
  type: 'pilot' | 'mech' | 'crawler',
  id: string,
  entityStore: ExportStore
): Promise<ExportBundle> {
  await Promise.all([entityStore.hydrate(type), entityStore.hydrate('softLink')])

  const allSoftLinks = entityStore.list('softLink')
  const attachedLinks = allSoftLinks.filter((l) => l.from.id === id || l.to.id === id)

  const emptyEntities = { pilots: [], mechs: [], crawlers: [] }

  switch (type) {
    case 'pilot': {
      const pilot = entityStore.list('pilot').find((p) => p.id === id)
      return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        entities: { ...emptyEntities, pilots: pilot ? [pilot] : [] },
        workspaces: [],
        softLinks: attachedLinks,
      }
    }
    case 'mech': {
      const mech = entityStore.list('mech').find((m) => m.id === id)
      return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        entities: { ...emptyEntities, mechs: mech ? [mech] : [] },
        workspaces: [],
        softLinks: attachedLinks,
      }
    }
    case 'crawler': {
      const crawler = entityStore.list('crawler').find((c) => c.id === id)
      return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        entities: { ...emptyEntities, crawlers: crawler ? [crawler] : [] },
        workspaces: [],
        softLinks: attachedLinks,
      }
    }
  }
}
