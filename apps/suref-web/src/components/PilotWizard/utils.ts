import type { SURefClass, SURefAbility, SURefEquipment } from 'salvageunion-reference'
import { SalvageUnionReference, getTechLevelNumber } from 'salvageunion-reference'

export interface WizardState {
  selectedClassId: string | null
  selectedAbilityId: string | null
  selectedEquipmentIds: string[]
  callsign: string
  background: string
  motto: string
  keepsake: string
  appearance: string
}

/**
 * Get level 1 abilities from each core tree for a class
 */
export function getLevel1AbilitiesForClass(cls: SURefClass): SURefAbility[] {
  if (!('coreTrees' in cls) || !Array.isArray(cls.coreTrees)) {
    return []
  }

  const allAbilities = SalvageUnionReference.Abilities.all()
  const level1Abilities: SURefAbility[] = []

  cls.coreTrees.forEach((treeName) => {
    const treeAbilities = allAbilities.filter(
      (ability) => ability.tree === treeName && Number(ability.level) === 1
    )
    level1Abilities.push(...treeAbilities)
  })

  return level1Abilities.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get all level 1 abilities from all core trees (for Salvager class)
 */
export function getAllCoreLevel1Abilities(): SURefAbility[] {
  const allAbilities = SalvageUnionReference.Abilities.all()
  const coreClasses = SalvageUnionReference.findAllIn(
    'classes',
    (c) =>
      'coreTrees' in c && Array.isArray(c.coreTrees) && ('hybrid' in c ? c.hybrid !== true : true)
  )

  const allCoreTrees = new Set<string>()
  coreClasses.forEach((cls) => {
    if ('coreTrees' in cls && Array.isArray(cls.coreTrees)) {
      cls.coreTrees.forEach((tree) => allCoreTrees.add(tree))
    }
  })

  return allAbilities
    .filter((ability) => allCoreTrees.has(ability.tree) && Number(ability.level) === 1)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get all Tech Level 1 equipment
 */
export function getTL1Equipment(): SURefEquipment[] {
  const allEquipment = SalvageUnionReference.Equipment.all()
  return allEquipment
    .filter((equip) => {
      const techLevel = getTechLevelNumber(equip)
      return techLevel === 1
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Validate if a wizard step is complete
 */
export function validateWizardStep(step: number, state: WizardState): boolean {
  switch (step) {
    case 1:
      return !!state.selectedClassId && !!state.selectedAbilityId
    case 2:
      return state.selectedEquipmentIds.length === 2
    case 3:
      return (
        !!state.callsign.trim() &&
        !!state.background.trim() &&
        !!state.motto.trim() &&
        !!state.keepsake.trim() &&
        !!state.appearance.trim()
      )
    default:
      return false
  }
}
