/**
 * Test data fixtures for live sheets
 *
 * Provides sample data for testing various scenarios
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type {
  SURefClass,
  SURefAbility,
  SURefEquipment,
  SURefSystem,
  SURefModule,
} from 'salvageunion-reference'

/**
 * Get a base class (non-hybrid, advanceable)
 */
export function getBaseClass(): SURefClass {
  const classes = SalvageUnionReference.Classes.all()
  const baseClass = classes.find(
    (cls) =>
      'coreTrees' in cls &&
      Array.isArray(cls.coreTrees) &&
      cls.advanceable === true &&
      (!('hybrid' in cls) || cls.hybrid !== true)
  )
  if (!baseClass) {
    throw new Error('No base class found in reference data')
  }
  return baseClass
}

/**
 * Get a non-advanceable base class
 */
export function getNonAdvanceableClass(): SURefClass | null {
  const classes = SalvageUnionReference.Classes.all()
  const nonAdvanceable = classes.find(
    (cls) =>
      'coreTrees' in cls &&
      Array.isArray(cls.coreTrees) &&
      cls.advanceable === false &&
      (!('hybrid' in cls) || cls.hybrid !== true)
  )
  return nonAdvanceable || null
}

/**
 * Get a hybrid class
 */
export function getHybridClass(): SURefClass | null {
  const classes = SalvageUnionReference.Classes.all()
  const hybrid = classes.find((cls) => 'hybrid' in cls && cls.hybrid === true)
  return hybrid || null
}

/**
 * Get an ability from a specific tree and level
 */
export function getAbilityByTreeAndLevel(
  tree: string,
  level: number | 'L' | 'G'
): SURefAbility | null {
  const abilities = SalvageUnionReference.Abilities.all()
  return abilities.find((ability) => ability.tree === tree && ability.level === level) || null
}

/**
 * Get all abilities for a specific tree
 */
export function getAbilitiesByTree(tree: string): SURefAbility[] {
  const abilities = SalvageUnionReference.Abilities.all()
  return abilities.filter((ability) => ability.tree === tree)
}

/**
 * Get a level 1 ability from a core tree
 */
export function getCoreTreeLevel1Ability(baseClass: SURefClass): SURefAbility | null {
  if (!('coreTrees' in baseClass) || !Array.isArray(baseClass.coreTrees)) {
    return null
  }
  const firstTree = baseClass.coreTrees[0]
  if (!firstTree) return null
  return getAbilityByTreeAndLevel(firstTree, 1)
}

/**
 * Get equipment with system slots
 */
export function getEquipmentWithSystemSlots(): SURefEquipment | null {
  const equipment = SalvageUnionReference.Equipment.all()
  return equipment.find((eq) => 'systemSlots' in eq && eq.systemSlots !== undefined) || null
}

/**
 * Get equipment with module slots
 */
export function getEquipmentWithModuleSlots(): SURefEquipment | null {
  const equipment = SalvageUnionReference.Equipment.all()
  return equipment.find((eq) => 'moduleSlots' in eq && eq.moduleSlots !== undefined) || null
}

/**
 * Get equipment without slots
 */
export function getEquipmentWithoutSlots(): SURefEquipment | null {
  const equipment = SalvageUnionReference.Equipment.all()
  return (
    equipment.find(
      (eq) =>
        (!('systemSlots' in eq) || eq.systemSlots === undefined) &&
        (!('moduleSlots' in eq) || eq.moduleSlots === undefined)
    ) || null
  )
}

/**
 * Get a system
 */
export function getSystem(): SURefSystem | null {
  const systems = SalvageUnionReference.Systems.all()
  return systems[0] || null
}

/**
 * Get a module
 */
export function getModule(): SURefModule | null {
  const modules = SalvageUnionReference.Modules.all()
  return modules[0] || null
}

/**
 * Get an ability that grants equipment
 */
export function getAbilityWithGrants(): SURefAbility | null {
  const abilities = SalvageUnionReference.Abilities.all()
  return abilities.find((ability) => ability.grants && ability.grants.length > 0) || null
}

/**
 * Get an ability with choices
 */
export function getAbilityWithChoices(): SURefAbility | null {
  // Note: This would need to check if the ability has choices in its grants
  // For now, return null - we'll need to check the actual data structure
  return null
}

/**
 * Get default pilot data for tests
 */
export function getDefaultPilotData() {
  return {
    callsign: 'Test Pilot',
    max_hp: 10,
    max_ap: 5,
    current_damage: 0,
    current_ap: 5,
    current_tp: 0,
  }
}

/**
 * Get pilot data with class selected
 */
export function getPilotWithClassData() {
  return {
    ...getDefaultPilotData(),
    // Note: class is stored as an entity, not directly on pilot
  }
}

/**
 * Get pilot data with abilities selected
 */
export function getPilotWithAbilitiesData(_abilityIds: string[], tpCost = 0) {
  return {
    ...getDefaultPilotData(),
    current_tp: tpCost,
    // Note: abilities are stored as entities, not directly on pilot
  }
}
