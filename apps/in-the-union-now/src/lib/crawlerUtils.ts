import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectGuideStep } from 'salvageunion-reference'
import type { WizardState } from './pilotUtils'
import type { CreateCrawlerInput } from '../types/common'

/** Roll table name used for crawler name step */
const ROLL_TABLE_CRAWLER_NAME = 'Crawler Name'

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
  const weaponStep = steps.find((s) => s.stepType === 'select-one' && s.schema?.[0] === 'systems')
  const nameStep = steps.find(
    (s) => s.stepType === 'roll-table' && s.rollTable === ROLL_TABLE_CRAWLER_NAME
  )

  const crawlerRef = crawlerTypeStep
    ? state.selections[crawlerTypeStep.id]?.selectedIds[0]
    : undefined
  if (!crawlerRef) return null

  const weaponRef = weaponStep ? state.selections[weaponStep.id]?.selectedIds[0] : undefined

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

  return {
    crawler_ref: crawlerRef,
    name,
    tag,
    weapon_ref: weaponRef
      ? { schema_name: 'systems' as const, schema_ref_id: weaponRef }
      : undefined,
  }
}

/** Get TL1 stats from the reference data */
export function computeCrawlerStatsFromTechLevel(techLevel: number): {
  max_sp: number
  upkeep: number
  upgrade_cost: number | null
} {
  const tl = SalvageUnionReference.CrawlerTechLevels.find((t) => t.techLevel === techLevel)
  return {
    max_sp: tl?.structurePoints ?? 20,
    upkeep: tl?.upkeepCost ?? 5,
    upgrade_cost: tl?.upgradeCost ?? null,
  }
}

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
