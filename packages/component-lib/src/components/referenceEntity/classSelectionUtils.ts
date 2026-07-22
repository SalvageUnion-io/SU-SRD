import type { SURefClass, SURefEntity } from 'salvageunion-reference'

type ClassSelections = {
  selectedClass: SURefClass | undefined
  selectedAdvancedClass: SURefClass | undefined
}

/**
 * Extracts class/advanced class selections from entity data via data-shape checks.
 * Used by consumers to build class abilities content for the afterExtraContent slot.
 */
export function getClassSelections(data: SURefEntity): ClassSelections {
  let selectedClass: SURefClass | undefined
  let selectedAdvancedClass: SURefClass | undefined

  if ('coreTrees' in data && Array.isArray(data.coreTrees)) {
    selectedClass = data
  }

  if ('hybrid' in data && data.hybrid === true) {
    selectedAdvancedClass = data
  }

  return { selectedClass, selectedAdvancedClass }
}
