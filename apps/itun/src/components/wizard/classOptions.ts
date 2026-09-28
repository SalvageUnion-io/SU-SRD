import type { SURefClass } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

type SURClassesAccessor = {
  all: () => unknown[]
}

/**
 * Semantic base-class guard: only classes with a non-empty `coreTrees` field
 * are true base classes (Engineer, Hauler, etc.). Advanced/Hybrid
 * specialisation classes in salvageunion-reference do NOT expose coreTrees.
 */
function isBaseClass(cls: unknown): cls is SelectableBaseClass {
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

/** A base class as narrowed by `isBaseClass` — `coreTrees` guaranteed present. */
export type SelectableBaseClass = SURefClass & { coreTrees: string[] }

/**
 * Selectable classes: base classes, plus — with `includeSpecialisations` (the
 * sheet's class picker) — the Advanced/Hybrid specialisation classes,
 * selectable regardless of prerequisites.
 */
export function selectableClasses(
  sur: SURClassesAccessor | undefined,
  includeSpecialisations: boolean
): { base: SelectableBaseClass[]; specialisations: SURefClass[] } {
  const all = (sur ?? SalvageUnionReference.Classes).all()
  return {
    base: all.filter(isBaseClass),
    specialisations: includeSpecialisations ? all.filter(isSpecialisationClass) : [],
  }
}
