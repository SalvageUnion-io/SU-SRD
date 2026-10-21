import type { EntityKind } from 'game-domain/entityKinds'
import type { EncounterNpc } from 'game-domain/schemas/encounterNpc'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { useEncounterStore } from '../../stores/encounterStore'
import { usePatternStore } from '../../stores/patternStore'
import type { EntityType } from '../../stores/types'
import type { ExportBundle } from '../schemas/exportBundle'

/**
 * Minimal store interface required by the build functions.
 * Accepts either the real Zustand entityStore or a test double.
 */
type ExportStore = {
  hydrate: (type: EntityType) => Promise<void>
  list: <T extends EntityType>(type: T) => import('../../stores/types').EntityForType<T>[]
}

/**
 * Minimal pattern source for export. Patterns are not in entityStore — they
 * live in their own store; tests may pass a double.
 */
type ExportPatternStore = {
  list: () => Promise<MechPattern[]>
}

/**
 * Minimal encounter-NPC source for export. Like patterns, encounterNpcs are
 * not in entityStore — they live in their own Zustand store;
 * tests may pass a double.
 */
type ExportEncounterNpcStore = {
  list: () => Promise<EncounterNpc[]>
}

/**
 * Read a collection store the way the app reads it right now: the account's
 * rows once they have arrived, and nothing signed out.
 */
function fromStore<T>(store: {
  getState: () => { hydrate: () => Promise<void>; list: () => T[] }
}): { list: () => Promise<T[]> } {
  return {
    async list() {
      await store.getState().hydrate()
      return store.getState().list()
    },
  }
}

/**
 * buildExportBundle — full backup of all entities and softLinks.
 *
 * Hydrates every store type first so the caller does not need to pre-hydrate.
 * The returned bundle is a plain serialisable object.
 */
export async function buildExportBundle(
  entityStore: ExportStore,
  patternStore: ExportPatternStore = fromStore<MechPattern>(usePatternStore),
  encounterNpcStore: ExportEncounterNpcStore = fromStore<EncounterNpc>(useEncounterStore)
): Promise<ExportBundle> {
  const [mechPatterns, encounterNpcs] = await Promise.all([
    patternStore.list(),
    encounterNpcStore.list(),
    entityStore.hydrate('pilot'),
    entityStore.hydrate('mech'),
    entityStore.hydrate('crawler'),
    entityStore.hydrate('npc'),
    entityStore.hydrate('softLink'),
  ])

  const bundle: ExportBundle = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    entities: {
      pilots: entityStore.list('pilot'),
      mechs: entityStore.list('mech'),
      crawlers: entityStore.list('crawler'),
      npcs: entityStore.list('npc'),
    },
    softLinks: entityStore.list('softLink'),
    mechPatterns,
    encounterNpcs,
  }
  return bundle
}

/**
 * buildEntityExport — single entity + its directly-attached softLinks.
 *
 * Only the entity and links whose `from.id` or `to.id` matches the entity id
 * are included.
 *
 * Design note: we do NOT pull in the referenced endpoints (e.g. the mech
 * that a pilot-to-mech link points to). A single-entity export is intended
 * for "send this pilot to a friend" use-cases — the friend builds their own
 * mechs. Including deep transitive closure would make the export ambiguous.
 */
export async function buildEntityExport(
  type: EntityKind,
  id: string,
  entityStore: ExportStore
): Promise<ExportBundle> {
  await Promise.all([entityStore.hydrate(type), entityStore.hydrate('softLink')])

  const allSoftLinks = entityStore.list('softLink')
  const attachedLinks = allSoftLinks.filter((l) => l.from.id === id || l.to.id === id)

  const emptyEntities = { pilots: [], mechs: [], crawlers: [], npcs: [] }

  switch (type) {
    case 'pilot': {
      const pilot = entityStore.list('pilot').find((p) => p.id === id)
      return {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        entities: { ...emptyEntities, pilots: pilot ? [pilot] : [] },
        softLinks: attachedLinks,
        mechPatterns: [],
        encounterNpcs: [],
      }
    }
    case 'mech': {
      const mech = entityStore.list('mech').find((m) => m.id === id)
      return {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        entities: { ...emptyEntities, mechs: mech ? [mech] : [] },
        softLinks: attachedLinks,
        mechPatterns: [],
        encounterNpcs: [],
      }
    }
    case 'crawler': {
      const crawler = entityStore.list('crawler').find((c) => c.id === id)
      return {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        entities: { ...emptyEntities, crawlers: crawler ? [crawler] : [] },
        softLinks: attachedLinks,
        mechPatterns: [],
        encounterNpcs: [],
      }
    }
    case 'npc': {
      const npc = entityStore.list('npc').find((n) => n.id === id)
      return {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        entities: { ...emptyEntities, npcs: npc ? [npc] : [] },
        softLinks: attachedLinks,
        mechPatterns: [],
        encounterNpcs: [],
      }
    }
  }
}

/**
 * buildPatternExport — one saved pattern on its own, for a shelf item's
 * "Export" (Shelves). Importing it makes a copy under a new id, as
 * every import does (`mergeImport`).
 */
export function buildPatternExport(pattern: MechPattern): ExportBundle {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    entities: { pilots: [], mechs: [], crawlers: [], npcs: [] },
    softLinks: [],
    mechPatterns: [pattern],
    encounterNpcs: [],
  }
}
