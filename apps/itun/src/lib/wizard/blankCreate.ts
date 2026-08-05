/**
 * Blank create — the escape hatch that skips the wizard and ALL creation-rule
 * limits (wizard-refresh Phase 1).
 *
 * `createBlank` builds a minimal create() payload through the EXISTING pure
 * form mappers (pilotFormState / mechFormState / crawlerFormState) and calls
 * the entity store's create() directly — the same persistence path
 * InstantiateFromPattern and merge-import already use. No WizShell, no rule
 * gates, no validation beyond the db layer's own strict Zod parse.
 *
 * Seeds collect ONLY the Zod-required fields plus the optional escape-valve
 * picks (class / chassis / tech level) that would otherwise strand the user
 * until the corresponding sheet editor exists.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import { useEntityStore } from '../../stores/entityStore'
import {
  crawlerFormToCreateInput,
  EMPTY_CRAWLER_FORM_STATE,
  EMPTY_SCRAP_POOL,
  seedDefaultCrawlerBays,
} from './crawlerFormState'
import { EMPTY_MECH_FORM_STATE, mechFormToCreateInput } from './mechFormState'
import { EMPTY_PILOT_FORM_STATE, pilotFormToCreateInput } from './pilotFormState'

/** The three entity kinds a Blank create can produce. */
export type BlankCreateKind = 'pilot' | 'mech' | 'crawler'

export type BlankPilotSeed = {
  name: string
  callsign: string
  /** Optional class ref (UNFILTERED — any class incl. specialisations). */
  classRef?: string
}

export type BlankMechSeed = {
  name: string
  /** Optional chassis slug ref (UNFILTERED — any Tech Level, no scrap cost). */
  chassisRef?: string
}

export type BlankCrawlerSeed = {
  name: string
  /** Optional Tech Level 1–6; defaults to 1 (Hamlet). */
  techLevel?: number
}

type BlankSeed = BlankPilotSeed | BlankMechSeed | BlankCrawlerSeed

/**
 * Creates a blank entity of the given kind and returns its id.
 *
 * The db layer still strict-parses the record (Zod is the source of truth) —
 * but no creation-rule budget, tech-level filter, or scrap cost applies.
 */
export async function createBlank(kind: 'pilot', seed: BlankPilotSeed): Promise<string>
export async function createBlank(kind: 'mech', seed: BlankMechSeed): Promise<string>
export async function createBlank(kind: 'crawler', seed: BlankCrawlerSeed): Promise<string>
export async function createBlank(kind: BlankCreateKind, seed: BlankSeed): Promise<string> {
  const store = useEntityStore.getState()

  if (kind === 'pilot') {
    const { name, callsign, classRef } = seed as BlankPilotSeed
    const created = await store.create(
      'pilot',
      pilotFormToCreateInput({
        ...EMPTY_PILOT_FORM_STATE,
        name,
        callsign,
        classId: classRef ?? '',
      })
    )
    return created.id
  }

  if (kind === 'mech') {
    const { name, chassisRef } = seed as BlankMechSeed
    // mechFormToCreateInput resolves the chassis itself: with a pick it seeds
    // full SP/EP from the chassis (like InstantiateFromPattern); without one
    // the current stats stay absent and the sheet derives 0-maxima safely.
    const created = await store.create(
      'mech',
      mechFormToCreateInput({
        ...EMPTY_MECH_FORM_STATE,
        name,
        chassisName: chassisRef ?? '',
      })
    )
    return created.id
  }

  const { name, techLevel } = seed as BlankCrawlerSeed
  const tl = clampTechLevel(techLevel ?? 1)
  // Bare stats for the level come straight from crawler-tech-levels.json via
  // the ORM; the default SRD bay set is seeded exactly like the wizard path.
  // No crawler type is picked — the schema reads absent `type` as untyped.
  const maxSP = SalvageUnionReference.CrawlerTechLevels.find(
    (t) => t.techLevel === tl
  )?.structurePoints
  const created = await store.create(
    'crawler',
    crawlerFormToCreateInput(
      {
        ...EMPTY_CRAWLER_FORM_STATE,
        name,
        techLevel: tl,
        scrapPool: { ...EMPTY_SCRAP_POOL },
      },
      {
        ...(maxSP !== undefined ? { maxSP } : {}),
        crawlerBays: seedDefaultCrawlerBays(),
      }
    )
  )
  return created.id
}

/** Clamp to a whole Tech Level 1–6 (defensive — the dialog offers 1–6 only). */
function clampTechLevel(tl: number): number {
  return Math.min(6, Math.max(1, Math.round(tl)))
}
