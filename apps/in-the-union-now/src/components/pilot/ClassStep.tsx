import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass, SURefEntity } from 'salvageunion-reference'
import { ClassAbilityTreeDisplay, ReferenceEntityDisplay } from 'suref-react'

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
 * Lightweight selectable row for the class list (design `.pick`/OptRow — NOT
 * an entity card). The full entity card + ability trees render in the detail
 * pane to the right.
 */
function ClassRow({
  cls,
  active,
  onSelect,
}: {
  cls: SURefClass
  active: boolean
  onSelect: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={[
        'flex cursor-pointer items-center justify-between rounded-[3px] border-[1.5px] border-su-black px-3 py-2.5 transition-shadow',
        active
          ? 'bg-white shadow-[inset_3px_0_0_var(--color-su-orange-dark)]'
          : 'bg-transparent hover:bg-white/60',
      ].join(' ')}
    >
      <span className="font-cond text-lg font-bold uppercase leading-none tracking-[0.02em] text-su-black">
        {cls.name}
      </span>
      {active && <span className="font-cond font-bold text-su-orange-dark">▸</span>}
    </div>
  )
}

/**
 * Step 1: Choose a pilot class — master-detail layout (design
 * board-screens.jsx ClassStep). A scannable list of class rows on the left;
 * the selected class's full entity card + ability trees in the detail pane
 * on the right.
 */
export function ClassStep({ selectedClassId, onSelect, _sur }: ClassStepProps) {
  const surClasses = _sur ?? SalvageUnionReference.Classes
  const allClasses = surClasses.all()
  const baseClasses = allClasses.filter(isBaseClass)
  const selectedClass = baseClasses.find((c) => c.id === selectedClassId)

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-su-grey-dark opacity-80">
        Choose your pilot class. This determines your ability trees.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Master — class list */}
        <div className="flex flex-col gap-2">
          {baseClasses.map((cls) => (
            <ClassRow
              key={cls.id}
              cls={cls}
              active={cls.id === selectedClassId}
              onSelect={() => onSelect(cls.id)}
            />
          ))}
        </div>

        {/* Detail — selected class card + ability trees */}
        <div className="min-w-0">
          {selectedClass ? (
            <ReferenceEntityDisplay
              data={selectedClass as unknown as SURefEntity}
              afterExtraContent={<ClassAbilityTreeDisplay classEntity={selectedClass} />}
            />
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center rounded-md border-[1.5px] border-dashed border-su-grey-light p-6 text-center text-sm text-su-grey-dark">
              Select a class to preview its ability trees.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
