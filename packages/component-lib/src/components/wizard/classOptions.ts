import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass } from 'salvageunion-reference'

type SURClassesAccessor = {
  all: () => unknown[]
}

/**
 * Semantic base-class guard: only classes with a non-empty `coreTrees` field
 * are true base classes (Engineer, Hauler, etc.). Advanced/Hybrid
 * specialisation classes in salvageunion-reference do NOT expose coreTrees.
 */
function isBaseClass(cls: unknown): cls is SURefClass & { coreTrees: string[] } {
  return (
    typeof cls === 'object' &&
    cls !== null &&
    'coreTrees' in cls &&
    Array.isArray(cls.coreTrees) &&
    cls.coreTrees.length > 0
  )
}

/** Advanced/Hybrid specialisation guard (advancedTree, no core trees). */
function isSpecialisationClass(cls: unknown): cls is SURefClass {
  return (
    typeof cls === 'object' &&
    cls !== null &&
    'advancedTree' in cls &&
    !isBaseClass(cls) &&
    'name' in cls
  )
}

/**
 * Selectable classes for the wizard. Create mode: base classes only.
 * Edit mode (`includeSpecialisations`): base classes plus Advanced/Hybrid
 * specialisation classes — selection is allowed regardless of prerequisites;
 * unmet prereqs surface as pre-save soft warnings (plan 3.3, never block).
 */
export function selectableClasses(
  sur: SURClassesAccessor | undefined,
  includeSpecialisations: boolean
): { base: SURefClass[]; specialisations: SURefClass[] } {
  const all = (sur ?? SalvageUnionReference.Classes).all()
  return {
    base: all.filter(isBaseClass),
    specialisations: includeSpecialisations ? all.filter(isSpecialisationClass) : [],
  }
}
