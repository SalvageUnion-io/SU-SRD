import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass } from 'salvageunion-reference'
import { ClassAbilityTreeDisplay } from 'suref-react'
import { EntityChoiceCard } from '../shared/EntityChoiceCard'

type SURClassesAccessor = {
  all: () => unknown[]
}

type ClassStepProps = {
  selectedClassId: string
  onSelect: (classId: string) => void
  /** Injectable SUR for testing. */
  _sur?: SURClassesAccessor
}

/**
 * Semantic base-class guard: only classes with a non-null `coreTrees` field
 * are true base classes (Scavenger, Hauler, etc.). Advanced classes in
 * salvageunion-reference do NOT expose coreTrees (they gate on a prior base
 * class). This check is intentionally semantic rather than structural —
 * the `coreTrees` field is the canonical marker per the SRD schema.
 */
function isBaseClass(cls: unknown): cls is SURefClass {
  return (
    typeof cls === 'object' &&
    cls !== null &&
    'coreTrees' in cls &&
    (cls as { coreTrees: unknown }).coreTrees !== null &&
    (cls as { coreTrees: unknown }).coreTrees !== undefined
  )
}

/**
 * Inline "Show abilities" disclosure rendered inside the class card via
 * ReferenceEntityDisplay's `afterExtraContent` slot — the same pattern the
 * SRD's ReferenceEntityIsland uses on a class detail page. Wrapped in a
 * native <details> so the wizard's many class cards stay compact by default.
 */
function ClassAbilitiesSlot({ cls }: { cls: SURefClass }) {
  return (
    <details className="group mt-2 rounded-md border border-[var(--color-su-grey-light)] bg-[var(--color-su-white)] px-3 py-2">
      <summary className="cursor-pointer select-none text-sm font-medium opacity-80 group-open:opacity-100">
        Show abilities
      </summary>
      <div className="mt-3">
        <ClassAbilityTreeDisplay classEntity={cls} />
      </div>
    </details>
  )
}

/**
 * Step 1: Choose a pilot class from available classes.
 *
 * Each card uses the SRD pattern — `ClassAbilityTreeDisplay` rendered
 * inside the card via the `afterExtraContent` slot. Wrapped in a
 * collapsible <details> so the wizard's many class cards stay compact
 * by default.
 */
export function ClassStep({ selectedClassId, onSelect, _sur }: ClassStepProps) {
  const surClasses = _sur ?? SalvageUnionReference.Classes
  const allClasses = surClasses.all()
  const baseClasses = allClasses.filter(isBaseClass)

  return (
    <div className="w-full space-y-4">
      <p className="text-sm opacity-70">
        Choose your pilot class. This determines your ability trees.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {baseClasses.map((cls) => (
          <EntityChoiceCard
            key={cls.id}
            entity={cls}
            selected={cls.id === selectedClassId}
            onSelect={() => onSelect(cls.id)}
            afterExtraContent={<ClassAbilitiesSlot cls={cls} />}
          />
        ))}
      </div>
    </div>
  )
}
