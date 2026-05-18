import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass } from 'salvageunion-reference'

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
  // Filter to base classes only — advanced/hybrid classes are unlocked through play
  const baseClasses = allClasses.filter(isBaseClass)

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-70">
        Choose your pilot class. This determines your ability trees.
      </p>
      <div className="grid gap-3">
        {baseClasses.map((cls) => {
          const isSelected = cls.id === selectedClassId
          return (
            <button
              key={cls.id}
              type="button"
              onClick={() => onSelect(cls.id)}
              className={[
                'w-full rounded-lg border p-4 text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-accent',
              ].join(' ')}
              aria-pressed={isSelected}
            >
              <div className="font-semibold">{cls.name}</div>
              {'coreTrees' in cls && cls.coreTrees && (
                <div className="mt-1 text-xs opacity-60">
                  Trees: {(cls.coreTrees as string[]).join(', ')}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
