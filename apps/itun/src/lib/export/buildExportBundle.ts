import type { EntityType } from '../../stores/types'
import { recordExport } from '../backupNudge'
import * as db from '../db/index'
import type { EncounterNpc } from '../schemas/encounterNpc'
import type { ExportBundle } from '../schemas/exportBundle'
import type { MechPattern } from '../schemas/pattern'

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
 * are read straight from the db layer; tests may pass a double.
 */
type ExportPatternStore = {
  list: () => Promise<MechPattern[]>
}

/**
 * Minimal encounter-NPC source for export. Like patterns, encounterNpcs are
 * not in entityStore — they live in their own Zustand store/db object store;
 * tests may pass a double.
 */
type ExportEncounterNpcStore = {
  list: () => Promise<EncounterNpc[]>
}

/**
 * buildExportBundle — full backup of all entities and softLinks.
 *
 * Hydrates every store type first so the caller does not need to pre-hydrate.
 * The returned bundle is a plain serialisable object — no IDB references.
 */
export async function buildExportBundle(
  entityStore: ExportStore,
  patternStore: ExportPatternStore = db.mechPatterns,
  encounterNpcStore: ExportEncounterNpcStore = db.encounterNpcs
): Promise<ExportBundle> {
  const [mechPatterns, encounterNpcs] = await Promise.all([
    patternStore.list(),
    encounterNpcStore.list(),
    entityStore.hydrate('pilot'),
    entityStore.hydrate('mech'),
    entityStore.hydrate('crawler'),
    entityStore.hydrate('softLink'),
  ])

  const bundle: ExportBundle = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    entities: {
      pilots: entityStore.list('pilot'),
      mechs: entityStore.list('mech'),
      crawlers: entityStore.list('crawler'),
    },
    workspaces: [],
    softLinks: entityStore.list('softLink'),
    mechPatterns,
    encounterNpcs,
  }
  // A full backup resets the backup-nudge clock (plan 2.6).
  recordExport()
  return bundle
}

/**
 * buildEntityExport — single entity + its directly-attached softLinks.
 *
 * Only the entity and links whose `from.id` or `to.id` matches the entity id
 * are included. `workspaces` is always `[]` — the field survives only so old
 * bundles keep parsing (see ExportBundleSchema); nothing writes it any more.
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
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        entities: { ...emptyEntities, pilots: pilot ? [pilot] : [] },
        workspaces: [],
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
        workspaces: [],
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
        workspaces: [],
        softLinks: attachedLinks,
        mechPatterns: [],
        encounterNpcs: [],
      }
    }
  }
}
