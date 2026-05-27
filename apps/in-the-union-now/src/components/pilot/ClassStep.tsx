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
 * Step 1: Choose a pilot class from available classes.
 * Only shows base classes (those with coreTrees defined).
 */
export function ClassStep({ selectedClassId, onSelect, _sur }: ClassStepProps) {
  const surClasses = _sur ?? SalvageUnionReference.Classes
  const allClasses = surClasses.all()
  const baseClasses = allClasses.filter(isBaseClass)

  const selectedClass = baseClasses.find((c) => c.id === selectedClassId)

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <p className="text-sm opacity-70">
        Choose your pilot class. This determines your ability trees.
      </p>
      <div className="flex flex-col gap-3">
        {baseClasses.map((cls) => (
          <EntityChoiceCard
            key={cls.id}
            entity={cls}
            selected={cls.id === selectedClassId}
            onSelect={() => onSelect(cls.id)}
          />
        ))}
      </div>
      {selectedClass && (
        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-70">
            {selectedClass.name} — Trees & Abilities
          </h3>
          <ClassAbilityTreeDisplay classEntity={selectedClass} />
        </div>
      )}
    </div>
  )
}
