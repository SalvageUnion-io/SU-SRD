import { SalvageUnionReference, isHybridClass, getAssetUrl } from 'salvageunion-reference'
import type { SURefClass, SURefChassis } from 'salvageunion-reference'
import { computeCrawlerStatsFromTechLevel } from '../lib/crawlerUtils'
import { getEntityAccess } from '../lib/entityAccess'
import type { EntityAccess } from '../lib/entityAccess'
import { findChassisById } from 'salvageunion-reference'
import { extractComrades } from '../lib/comradeUtils'
import type { ComradeEntry } from '../lib/comradeUtils'
import type { PilotRow, MechRow, CrawlerRow, EntityRefRow } from '../types/common'

type ComputePilotSheetInput = {
  pilot: PilotRow | undefined
  pilotRefs: EntityRefRow[]
  mech: MechRow | undefined
  mechRefs: EntityRefRow[]
  crawler: CrawlerRow | undefined
  userId: string | undefined
}

type PilotSheetDerived = {
  pilotClass: SURefClass | undefined
  cardColor: string
  pilotClassName: string
  pilotClassAssetUrl: string | undefined
  abilityCount: number
  mechChassis: SURefChassis | undefined
  chassisName: string | undefined
  patternName: string | undefined
  comrades: ComradeEntry[]
  crawlerTlStats: { max_sp: number; upkeep: number; upgrade_cost: number | null } | undefined
  access: EntityAccess | undefined
  canEdit: boolean
}

/**
 * Pure derivation function for pilot sheet computed state.
 * Exported for direct testing without React hook overhead.
 */
export function computePilotSheetDerived(input: ComputePilotSheetInput): PilotSheetDerived {
  const { pilot, pilotRefs, mech, mechRefs, crawler, userId } = input

  const pilotClass = pilot ? SalvageUnionReference.get('classes', pilot.class_ref) : undefined
  const cardColor = pilotClass && isHybridClass(pilotClass) ? 'bg-su-pink' : 'bg-su-orange'
  const pilotClassName = pilotClass?.name ?? 'Unknown'
  const pilotClassAssetUrl = pilotClass ? getAssetUrl(pilotClass) : undefined
  const abilityCount = pilotRefs.filter((r) => r.schema_name === 'abilities').length

  const mechChassis = mech ? findChassisById(mech.chassis_ref) : undefined
  const chassisName = mechChassis?.name
  const patternName = mech?.pattern_name ? `\u201C${mech.pattern_name}\u201D` : undefined

  const comrades = extractComrades(pilotRefs, mechRefs, mechChassis)

  const crawlerTlStats = crawler
    ? computeCrawlerStatsFromTechLevel(crawler.tech_level, crawler.crawler_ref)
    : undefined

  const access = pilot ? getEntityAccess(pilot, userId) : undefined
  const canEdit = access?.canView ? access.canEdit : false

  return {
    pilotClass,
    cardColor,
    pilotClassName,
    pilotClassAssetUrl,
    abilityCount,
    mechChassis,
    chassisName,
    patternName,
    comrades,
    crawlerTlStats,
    access,
    canEdit,
  }
}
