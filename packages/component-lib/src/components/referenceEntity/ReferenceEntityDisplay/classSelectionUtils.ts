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

  if ('coreTrees' in data && Array.isArray((data as { coreTrees: string[] }).coreTrees)) {
    selectedClass = data as SURefClass
  }

  if ('hybrid' in data && (data as { hybrid?: boolean }).hybrid === true) {
    selectedAdvancedClass = data as SURefClass
  }

  return { selectedClass, selectedAdvancedClass }
}
