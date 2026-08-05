/**
 * Crawler wizard form-state contract + entity mappers (plan 3.1).
 *
 * CrawlerWizardFormState is the layout-agnostic seam between the wizard UI
 * and the persisted Crawler entity:
 *   - `crawlerToFormState` maps a stored crawler onto initial wizard state
 *     (edit-mode prefill — greenfield per plan 3.1).
 *   - `crawlerFormToCreateInput` builds the create() payload (seeded bays,
 *     full SP for the tech level).
 *   - `crawlerFormToUpdatePatch` builds the update() patch for the upsert
 *     branch. It contains ONLY wizard-owned fields — live-play state
 *     (crawlerBays + NPC state, bayChoices, currentSP, cargoLots,
 *     maxSpModifier, workspaceId, …) is never clobbered by an edit pass.
 *
 * All functions are pure over their inputs — no store, no React. The only
 * exception is `seedDefaultCrawlerBays`, which reads the SRD bay catalog.
 */

import type { ChoiceSelections } from 'component-lib'
import type { SURefCrawler } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { parseCrawlerTechLevel } from '../crawlerLevel'
import type { ResolvedNpc } from '../crawlerRefs'
import { findNpcChoiceByName, resolveCrawlerBay, resolveCrawlerType } from '../crawlerRefs'
import type { Crawler, CrawlerNpcState, ScrapPool } from '../schemas/crawler'

type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

/** Freeform crew/NPC details captured per NPC in the wizard's Crew step. */
export type CrewNpcForm = {
  name?: string
  description?: string
  keepsake?: string
  motto?: string
}

/** First value of a single-element choice-selection array, or undefined. */
function firstSelection(
  selections: ChoiceSelections | undefined,
  choiceId: string | undefined
): string | undefined {
  if (!selections || !choiceId) return undefined
  const v = selections[choiceId]?.[0]
  return v && v.length > 0 ? v : undefined
}

/** Read a crew form's structured Name/Description + Keepsake/Motto from storage. */
function crewFormFromStorage(
  npc: ResolvedNpc | undefined,
  npcState: CrawlerNpcState | undefined,
  selections: ChoiceSelections | undefined
): CrewNpcForm {
  return {
    name: npcState?.npcName,
    description: npcState?.npcDescription,
    keepsake: firstSelection(selections, findNpcChoiceByName(npc, 'Keepsake')?.id),
    motto: firstSelection(selections, findNpcChoiceByName(npc, 'Motto')?.id),
  }
}

/** Scrap-pool form shape: every TL bucket present (zeros allowed). */
export type ScrapPoolForm = Required<ScrapPool>

export const EMPTY_SCRAP_POOL: ScrapPoolForm = {
  tl1: 0,
  tl2: 0,
  tl3: 0,
  tl4: 0,
  tl5: 0,
  tl6: 0,
}

/** Shape of form state carried through the crawler wizard. */
export type CrawlerWizardFormState = {
  name: string
  /** Freeform crawler description (maps to Crawler.description). */
  description: string
  /** Numeric tech level 1–6; new crawlers fix this at 1, edit preserves stored. */
  techLevel: number | null
  /** Chosen crawler-type ref (SRD id); null until chosen. */
  type: string | null
  /** Installed system ids. */
  systems: string[]
  /**
   * Freeform crew/NPC details, keyed by the bay ref (and the type ref for the
   * crawler-type's special NPC). Captured in the wizard's Crew step.
   */
  crew: Record<string, CrewNpcForm>
  /** Shared party scrap pool, TL-bucketed (rules C5). */
  scrapPool: ScrapPoolForm
  /** Upgrade Pool progress (rules C4). */
  upgradePool: number
}

export const EMPTY_CRAWLER_FORM_STATE: CrawlerWizardFormState = {
  name: '',
  description: '',
  // New crawlers always start at Tech Level 1 (Hamlet); upgraded on the sheet.
  techLevel: 1,
  type: null,
  systems: [],
  crew: {},
  scrapPool: { ...EMPTY_SCRAP_POOL },
  upgradePool: 0,
}

/** Maps a stored crawler onto wizard initial state (edit-mode prefill). */
export function crawlerToFormState(crawler: Crawler): CrawlerWizardFormState {
  const crew: Record<string, CrewNpcForm> = {}

  // Hydrate each base bay's crew form (structured name/desc + Keepsake/Motto).
  for (const entry of crawler.crawlerBays ?? []) {
    const bay = resolveCrawlerBay(entry.bayRef)
    if (!bay?.npc) continue
    crew[entry.bayRef] = crewFormFromStorage(bay.npc, entry, crawler.bayChoices?.[entry.bayRef])
  }

  // Hydrate the crawler-type's special NPC, keyed by the type ref.
  if (crawler.type) {
    const typeEntity = resolveCrawlerType(crawler.type)
    if (typeEntity?.npc) {
      crew[crawler.type] = crewFormFromStorage(
        typeEntity.npc,
        crawler.typeNpc,
        crawler.bayChoices?.[crawler.type]
      )
    }
  }

  return {
    name: crawler.name,
    description: crawler.description ?? '',
    // Keep the stored tech level on edit — only create fixes it at 1.
    techLevel: parseCrawlerTechLevel(crawler.techLevel) ?? null,
    type: crawler.type ?? null,
    systems: [...crawler.systems],
    crew,
    scrapPool: { ...EMPTY_SCRAP_POOL, ...(crawler.scrapPool ?? {}) },
    upgradePool: crawler.upgradePool ?? 0,
  }
}

/**
 * Normalizes the form's scrap pool for persistence: zero buckets are
 * stripped (the schema reads absent buckets as 0).
 */
export function toScrapPoolPatch(pool: ScrapPoolForm): ScrapPool {
  const out: ScrapPool = {}
  for (const key of ['tl1', 'tl2', 'tl3', 'tl4', 'tl5', 'tl6'] as const) {
    if (pool[key] > 0) out[key] = pool[key]
  }
  return out
}

/** Wizard-owned crawler fields — the only fields an edit save may touch. */
type CrawlerWizardPatch = Pick<
  Crawler,
  'name' | 'description' | 'techLevel' | 'type' | 'systems' | 'scrapPool' | 'upgradePool'
>

export function crawlerFormToUpdatePatch(form: CrawlerWizardFormState): CrawlerWizardPatch {
  if (form.techLevel === null) {
    throw new Error('Cannot build a crawler patch without a tech level')
  }
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    techLevel: `tech-${form.techLevel}`,
    // The chosen crawler type — additive wizard-owned field. Crew/NPC edits do
    // NOT go through this patch (they route through crawlerFormCrewToPatches so
    // live HP/condition survive an edit save).
    ...(form.type !== null ? { type: form.type } : {}),
    systems: form.systems,
    // Always present in the patch so buckets can be zeroed out on edit.
    scrapPool: toScrapPoolPatch(form.scrapPool),
    upgradePool: form.upgradePool,
  }
}

/**
 * Build the default crawler-bay set seeded onto every new crawler.
 *
 * Only the BASE crawler facilities are pre-installed: the Core Book's Union
 * Crawler Bays (Command, Mech, Storage, …; "Your Union Crawler has the
 * following Bays", Core Book p.221). Expansion bays (`expansion: true` —
 * Bio-Mech Bay, Bio-Crafting Bay, Nanite Processing Bay, VR Tubes) are
 * acquired during play (built for a resource cost or found as a scenario
 * facility), so they are filtered out of the seed. Each seeded entry seeds the
 * embedded NPC's current HP from the bay's `npc.hitPoints` (4). The array is
 * extensible — a crawler can gain expansion bays later.
 */
export function seedDefaultCrawlerBays(): CrawlerBayEntry[] {
  type BayWithNpc = { id: string; expansion?: boolean; npc?: { hitPoints?: number } }
  let bays: BayWithNpc[]
  try {
    bays = SalvageUnionReference.CrawlerBays.all()
  } catch {
    bays = []
  }
  return bays
    .filter((bay) => !bay.expansion)
    .map((bay) => {
      const maxHP = bay.npc?.hitPoints
      return {
        bayRef: bay.id,
        ...(typeof maxHP === 'number' ? { npcCurrentHP: maxHP } : {}),
      }
    })
}

/** Structured npcName/npcDescription patch from a crew form (only set keys). */
function npcStatePatch(crew: CrewNpcForm | undefined): CrawlerNpcState {
  const out: CrawlerNpcState = {}
  if (crew?.name && crew.name.trim().length > 0) out.npcName = crew.name.trim()
  if (crew?.description && crew.description.trim().length > 0) {
    out.npcDescription = crew.description.trim()
  }
  return out
}

/** Build the `bayChoices` entry (Keepsake/Motto) for one NPC's crew form. */
function npcChoiceSelections(
  npc: ResolvedNpc | undefined,
  crew: CrewNpcForm | undefined
): ChoiceSelections | undefined {
  const keepsakeId = findNpcChoiceByName(npc, 'Keepsake')?.id
  const mottoId = findNpcChoiceByName(npc, 'Motto')?.id
  const out: ChoiceSelections = {}
  if (keepsakeId && crew?.keepsake && crew.keepsake.trim().length > 0) {
    out[keepsakeId] = [crew.keepsake.trim()]
  }
  if (mottoId && crew?.motto && crew.motto.trim().length > 0) {
    out[mottoId] = [crew.motto.trim()]
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Default structured state for a crawler-type's special NPC: its max HP from
 * the SRD `npc.hitPoints` (when present; Augmented's A.I. is 0 → absent). Used
 * to RESET the type NPC when the wizard switches a crawler to a different type.
 */
export function defaultTypeNpcState(types: SURefCrawler[], typeRef: string): CrawlerNpcState {
  const type = types.find((t) => t.id === typeRef || t.name === typeRef)
  const maxHP = type?.npc?.hitPoints
  // Mirror the create path: seed npcCurrentHP from the SRD hitPoints when the
  // field is present (Augmented's A.I. is 0 → seeds 0, renders no HP block).
  return typeof maxHP === 'number' ? { npcCurrentHP: maxHP } : {}
}

/**
 * Create payload for a fresh crawler: seeded SRD bay set, full SP for the
 * tech level, the chosen type + its special NPC, the crew's structured/choice
 * NPC details, and the starting resources from the Identity step.
 */
export function crawlerFormToCreateInput(
  form: CrawlerWizardFormState,
  opts: {
    /** Max SP for the chosen tech level — fresh crawlers start at full SP. */
    maxSP?: number
    /** Seeded bay entries (pass `seedDefaultCrawlerBays()`). */
    crawlerBays: CrawlerBayEntry[]
  }
) {
  const bayChoices: Record<string, ChoiceSelections> = {}

  // Fold each bay's crew form into the seeded entry's structured NPC state
  // (name/description) plus a Keepsake/Motto bayChoices entry. Only fold for
  // entries that resolve to a REAL bay — a stale/unknown ref is never written.
  const crawlerBays = opts.crawlerBays.map((entry) => {
    const crew = form.crew[entry.bayRef]
    if (!crew) return entry
    const bay = resolveCrawlerBay(entry.bayRef)
    if (!bay) return entry
    const selections = npcChoiceSelections(bay.npc, crew)
    if (selections) bayChoices[entry.bayRef] = selections
    return { ...entry, ...npcStatePatch(crew) }
  })

  // The crawler-type's special NPC: structured state in `typeNpc`, Keepsake/
  // Motto in `bayChoices` keyed by the type ref.
  let typeNpc: CrawlerNpcState | undefined
  if (form.type) {
    const typeEntity = resolveCrawlerType(form.type)
    const crew = form.crew[form.type]
    const npc = typeEntity?.npc
    const state = npcStatePatch(crew)
    const maxHP = npc?.hitPoints
    typeNpc = {
      ...state,
      ...(typeof maxHP === 'number' ? { npcCurrentHP: maxHP } : {}),
    }
    if (Object.keys(typeNpc).length === 0) typeNpc = undefined
    const selections = npcChoiceSelections(npc, crew)
    if (selections) bayChoices[form.type] = selections
  }

  return {
    schemaVersion: 1 as const,
    ...crawlerFormToUpdatePatch(form),
    crawlerBays,
    ...(typeNpc ? { typeNpc } : {}),
    ...(Object.keys(bayChoices).length > 0 ? { bayChoices } : {}),
    ...(opts.maxSP !== undefined ? { currentSP: opts.maxSP } : {}),
  }
}

/**
 * Crew edits applied on an edit-mode save. The returned patches route through
 * targeted `updateCrawlerBay` calls + a single `bayChoices` merge + a `typeNpc`
 * patch (mirroring how the sheet persists) so live HP/condition on bays and the
 * type NPC are never clobbered by an edit pass.
 */
type CrawlerFormCrewPatches = {
  /** Per-bay structured NPC state patches, keyed by bay ref. */
  bayPatches: Record<string, CrawlerNpcState>
  /** Merged Keepsake/Motto selections, keyed by bay ref (or type ref). */
  bayChoices: Record<string, ChoiceSelections>
  /** Structured state patch for the crawler-type's special NPC, if any. */
  typeNpc?: CrawlerNpcState
}

export function crawlerFormCrewToPatches(form: CrawlerWizardFormState): CrawlerFormCrewPatches {
  const bayPatches: Record<string, CrawlerNpcState> = {}
  const bayChoices: Record<string, ChoiceSelections> = {}

  for (const [ref, crew] of Object.entries(form.crew)) {
    const isType = form.type !== null && ref === form.type
    if (isType) {
      // The type NPC's structured state is handled below (typeNpc); only its
      // Keepsake/Motto selections route through bayChoices keyed by the type ref.
      const selections = npcChoiceSelections(resolveCrawlerType(ref)?.npc, crew)
      if (selections) bayChoices[ref] = selections
      continue
    }

    // Guard: a non-type ref must resolve to a REAL bay before we write a bay
    // patch or selections for it. A stale ref (e.g. a previously-chosen type id
    // left in form.crew after switching type) is dropped, never written as a
    // phantom bay entry.
    const bay = resolveCrawlerBay(ref)
    if (!bay) continue

    const selections = npcChoiceSelections(bay.npc, crew)
    if (selections) bayChoices[ref] = selections

    bayPatches[ref] = npcStatePatch(crew)
  }

  let typeNpc: CrawlerNpcState | undefined
  if (form.type && form.crew[form.type]) {
    typeNpc = npcStatePatch(form.crew[form.type])
  }

  return { bayPatches, bayChoices, ...(typeNpc ? { typeNpc } : {}) }
}
