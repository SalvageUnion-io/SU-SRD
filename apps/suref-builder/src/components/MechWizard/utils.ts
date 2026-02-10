import type { SURefChassis } from 'salvageunion-reference'
import {
  SalvageUnionReference,
  getTechLevel,
  getTechLevelNumber,
  getSalvageValue,
} from 'salvageunion-reference'

export interface WizardState {
  selectedChassisId: string | null
  selectedSystemIds: string[]
  selectedModuleIds: string[]
  selectedPatternName: string | null
  appearance: string
  quirk: string
  patternName: string
}

const STARTING_BUDGET = 20

/**
 * Get all chassis from the Workshop Manual
 */
export function getWorkshopManualChassis(): SURefChassis[] {
  const allChassis = SalvageUnionReference.Chassis.all()
  return allChassis
    .filter((chassis) => chassis.source === 'Salvage Union Workshop Manual')
    .sort((a, b) => {
      const aTL = getTechLevelNumber(a) ?? 0
      const bTL = getTechLevelNumber(b) ?? 0
      if (aTL !== bTL) {
        return aTL - bTL
      }
      return a.name.localeCompare(b.name)
    })
}

/**
 * Get chassis filtered by tech level
 */
export function getChassisByTechLevel(
  chassis: SURefChassis[],
  techLevel: number | 'B' | 'N'
): SURefChassis[] {
  return chassis.filter((c) => {
    const tl = getTechLevel(c)
    return tl === techLevel
  })
}

/**
 * Calculate total cost of selected items in TL1 scrap
 * Cost = Tech Level × Salvage Value
 */
export function calculateTotalCost(
  chassisId: string | null,
  systemIds: string[],
  moduleIds: string[]
): number {
  let total = 0

  if (chassisId) {
    const chassis = SalvageUnionReference.Chassis.find((c) => c.id === chassisId)
    if (chassis) {
      const techLevel = getTechLevelNumber(chassis) ?? 0
      const salvageValue = getSalvageValue(chassis) ?? 0
      total += techLevel * salvageValue
    }
  }

  systemIds.forEach((systemId) => {
    const system = SalvageUnionReference.get('systems', systemId)
    if (system) {
      const techLevel = getTechLevelNumber(system) ?? 0
      const salvageValue = getSalvageValue(system) ?? 0
      total += techLevel * salvageValue
    }
  })

  moduleIds.forEach((moduleId) => {
    const module = SalvageUnionReference.get('modules', moduleId)
    if (module) {
      const techLevel = getTechLevelNumber(module) ?? 0
      const salvageValue = getSalvageValue(module) ?? 0
      total += techLevel * salvageValue
    }
  })

  return total
}

/**
 * Calculate remaining budget
 */
export function calculateRemainingBudget(state: WizardState): number {
  const totalCost = calculateTotalCost(
    state.selectedChassisId,
    state.selectedSystemIds,
    state.selectedModuleIds
  )
  return STARTING_BUDGET - totalCost
}

/**
 * Validate if a wizard step is complete
 */
export function validateWizardStep(step: number, state: WizardState): boolean {
  switch (step) {
    case 1:
      return !!state.selectedChassisId
    case 2:
      // Step 2 is always valid - user can progress at any time
      return true
    case 3:
      return !!state.appearance.trim() && !!state.quirk.trim() && !!state.patternName.trim()
    default:
      return false
  }
}

export { STARTING_BUDGET }
