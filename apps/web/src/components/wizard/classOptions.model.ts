import type { RefClass, RefMetaEntity } from 'salvageunion-reference'
import { isBaseAdvancedClass, isCoreClass, SalvageUnionReference } from 'salvageunion-reference'

type SURClassesAccessor = {
  all: () => unknown[]
}

/**
 * A true base (Core) class: Engineer, Hauler, … — the reference's own
 * `isCoreClass`, so the wizard and the Change Class picker share one test.
 * The accessor is `unknown`-typed for its test seam, so the one cast is here.
 */
function isBaseClass(cls: unknown): cls is SelectableBaseClass {
  return isCoreClass(cls as RefMetaEntity)
}

/** An Advanced/Hybrid specialisation class — the reference's `isBaseAdvancedClass`. */
function isSpecialisationClass(cls: unknown): cls is RefClass {
  return isBaseAdvancedClass(cls as RefMetaEntity)
}

/** A base class as narrowed by `isBaseClass` — `coreTrees` guaranteed present. */
export type SelectableBaseClass = RefClass & { coreTrees: string[] }

/**
 * Selectable classes: base classes, plus — with `includeSpecialisations` (the
 * sheet's class picker) — the Advanced/Hybrid specialisation classes,
 * selectable regardless of prerequisites.
 */
export function selectableClasses(
  sur: SURClassesAccessor | undefined,
  includeSpecialisations: boolean
): { base: SelectableBaseClass[]; specialisations: RefClass[] } {
  const all = (sur ?? SalvageUnionReference.Classes).all()
  return {
    base: all.filter(isBaseClass),
    specialisations: includeSpecialisations ? all.filter(isSpecialisationClass) : [],
  }
}
