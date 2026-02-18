import { SalvageUnionReference, getWeaponSlotCount, getMaxSpBonus } from 'salvageunion-reference'
import type { SURefObjectGuideStep } from 'salvageunion-reference'
import { canSubmitWizard } from './pilotUtils'
import type { WizardState, ConstraintOverride } from './pilotUtils'
import type { BayNpcData, CreateCrawlerInput } from '../types/common'

/** Roll table name used for crawler name step */
const ROLL_TABLE_CRAWLER_NAME = 'Crawler Name'

/** String-only keys from BayNpcData (excludes `damaged` boolean and `hp` number) */
type BayNpcTextField = Exclude<keyof BayNpcData, 'damaged' | 'hp'>

/** Choice field names mapped to BayNpcData keys */
const CHOICE_NAME_TO_FIELD: Record<string, BayNpcTextField> = {
  Name: 'name',
  Description: 'description',
  Motto: 'motto',
  Keepsake: 'keepsake',
  'A.I. Personality': 'personality',
}

/**
 * Constraint override for the crawler creation wizard.
 * Resolves weapon step min/max from the selected crawler type's mutations.
 */
export const crawlerConstraintOverride: ConstraintOverride = (step, state, steps) => {
  // Only override for the weapons (systems) step
  if (step.schema?.[0] !== 'systems') return undefined
  const crawlerTypeStep = steps.find(
    (s) => s.stepType === 'select-one' && s.schema?.[0] === 'crawlers'
  )
  const crawlerRef = crawlerTypeStep
    ? state.selections[crawlerTypeStep.id]?.selectedIds[0]
    : undefined
  const slotCount = crawlerRef ? getWeaponSlotCount(crawlerRef) : 1
  return { min: slotCount, max: slotCount }
}

/** Check if all required steps are complete, including weapon slot validation. */
export function canSubmitCrawlerWizard(state: WizardState, steps: SURefObjectGuideStep[]): boolean {
  return canSubmitWizard(state, steps, crawlerConstraintOverride)
}

/**
 * Extract bay_npcs from choiceValues.
 * Maps choice UUIDs back to their parent entity (bay or crawler type)
 * and builds BayNpcData records keyed by entity ID.
 */
export function extractBayNpcs(
  choiceValues: Record<string, string>,
  crawlerTypeId?: string
): Record<string, BayNpcData> {
  // Build a lookup: choiceId → { parentId, fieldKey }
  const choiceMap = new Map<string, { parentId: string; field: BayNpcTextField }>()

  // Crawler type NPC
  if (crawlerTypeId) {
    const crawlerType = SalvageUnionReference.Crawlers.find((c) => c.id === crawlerTypeId)
    if (crawlerType?.npc?.choices) {
      for (const choice of crawlerType.npc.choices) {
        const field = CHOICE_NAME_TO_FIELD[choice.name]
        if (field) {
          choiceMap.set(choice.id, { parentId: crawlerType.id, field })
        }
      }
    }
  }

  // All bay NPCs
  for (const bay of SalvageUnionReference.CrawlerBays.all()) {
    if (bay.npc?.choices) {
      for (const choice of bay.npc.choices) {
        const field = CHOICE_NAME_TO_FIELD[choice.name]
        if (field) {
          choiceMap.set(choice.id, { parentId: bay.id, field })
        }
      }
    }
  }

  // Build the result
  const result: Record<string, BayNpcData> = {}
  for (const [choiceId, value] of Object.entries(choiceValues)) {
    const mapping = choiceMap.get(choiceId)
    if (!mapping || !value.trim()) continue
    const entry = result[mapping.parentId] ?? {}
    entry[mapping.field] = value.trim()
    result[mapping.parentId] = entry
  }

  return result
}

/**
 * Convert crawler wizard state → CreateCrawlerInput for the API layer.
 * Returns null if required fields (crawler type) are missing.
 */
export function crawlerWizardToCreateInput(
  state: WizardState,
  steps: SURefObjectGuideStep[]
): CreateCrawlerInput | null {
  // Find steps by type/schema
  const crawlerTypeStep = steps.find(
    (s) => s.stepType === 'select-one' && s.schema?.[0] === 'crawlers'
  )
  const weaponStep = steps.find(
    (s) =>
      (s.stepType === 'select-one' || s.stepType === 'select-many') && s.schema?.[0] === 'systems'
  )
  const npcStep = steps.find((s) => s.stepType === 'freeform' && s.schema?.[0] === 'crawler-bays')
  const nameStep = steps.find(
    (s) => s.stepType === 'roll-table' && s.rollTable === ROLL_TABLE_CRAWLER_NAME
  )

  const crawlerRef = crawlerTypeStep
    ? state.selections[crawlerTypeStep.id]?.selectedIds[0]
    : undefined
  if (!crawlerRef) return null

  const weaponIds = weaponStep ? (state.selections[weaponStep.id]?.selectedIds ?? []) : []

  const nameText = nameStep ? state.selections[nameStep.id]?.textValue : undefined

  // Parse name/tag from the text (e.g. "Crawler #132 - Tin Lizzy" or just "Tin Lizzy")
  let name: string | undefined
  let tag: string | undefined
  if (nameText?.trim()) {
    const trimmed = nameText.trim()
    // Try to extract a tag number like "#123"
    const tagMatch = trimmed.match(/#(\d+)/)
    if (tagMatch) {
      tag = tagMatch[1]
      // The name is everything except the tag part
      name = trimmed
        .replace(/#\d+/, '')
        .replace(/\s*-\s*/, '')
        .trim()
      if (!name) name = undefined
    } else {
      name = trimmed
    }
  }

  // Extract NPC choice values
  const choiceValues = npcStep ? state.selections[npcStep.id]?.choiceValues : undefined
  const bayNpcs = choiceValues ? extractBayNpcs(choiceValues, crawlerRef) : undefined

  const weaponRefs =
    weaponIds.length > 0
      ? weaponIds.map((id) => ({ schema_name: 'systems' as const, schema_ref_id: id }))
      : undefined

  return {
    crawler_ref: crawlerRef,
    name,
    tag,
    weapon_ref: weaponRefs?.[0],
    weapon_refs: weaponRefs,
    bay_npcs: bayNpcs && Object.keys(bayNpcs).length > 0 ? bayNpcs : undefined,
  }
}

/** Get stats from the reference data for a given tech level, with optional crawler type SP bonus */
export function computeCrawlerStatsFromTechLevel(
  techLevel: number,
  crawlerRef?: string
): {
  max_sp: number
  upkeep: number
  upgrade_cost: number | null
} {
  const tl = SalvageUnionReference.CrawlerTechLevels.find((t) => t.techLevel === techLevel)
  const spBonus = crawlerRef ? getMaxSpBonus(crawlerRef) : 0
  return {
    max_sp: (tl?.structurePoints ?? 20) + spBonus,
    upkeep: tl?.upkeepCost ?? 5,
    upgrade_cost: tl?.upgradeCost ?? null,
  }
}

// Re-export for convenience
export { getWeaponSlotCount }

/**
 * Compute scrap translation between tech levels.
 * Conversion: N units of TL1 = 1 unit of TL N.
 * All conversions normalize through TL1 as an intermediate.
 *
 * Returns the amount of target TL produced, or null if insufficient source.
 */
export function computeScrapTranslation(
  fromTL: number,
  toTL: number,
  sourceAmount: number
): { targetAmount: number; sourceConsumed: number } | null {
  if (fromTL < 1 || fromTL > 6 || toTL < 1 || toTL > 6) return null
  if (fromTL === toTL) return null
  if (sourceAmount <= 0) return null

  // Normalize through TL1: each unit of fromTL is worth fromTL TL1 units
  const tl1Equivalent = sourceAmount * fromTL
  const targetAmount = Math.floor(tl1Equivalent / toTL)

  if (targetAmount < 1) return null

  // Compute how much source is actually consumed (may not use all if there's a remainder)
  const tl1Used = targetAmount * toTL
  const sourceConsumed = Math.ceil(tl1Used / fromTL)

  return { targetAmount, sourceConsumed }
}
