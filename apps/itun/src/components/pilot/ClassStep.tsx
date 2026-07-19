import type { SURefClass, SURefEntity } from 'salvageunion-reference'
import { ClassAbilityTree, EmptyState, OptRow, ReferenceEntityCard, TreeSep } from 'component-lib'
import { classDescription } from './classOptions'

type ClassOptionListProps = {
  base: SURefClass[]
  specialisations: SURefClass[]
  selectedClassId: string
  onSelect: (classId: string) => void
}

/**
 * Master pane for the Class step (design §3.2b): OptRow per class, with
 * Advanced/Hybrid specialisations under their own separator in edit mode.
 */
export function ClassOptionList({
  base,
  specialisations,
  selectedClassId,
  onSelect,
}: ClassOptionListProps) {
  return (
    <div>
      {base.map((cls) => (
        <OptRow
          key={cls.id}
          name={cls.name}
          desc={classDescription(cls)}
          active={cls.id === selectedClassId}
          onClick={() => onSelect(cls.id)}
        />
      ))}
      {specialisations.length > 0 && (
        <>
          <div className="mb-2 mt-5">
            <TreeSep name="Advanced / Hybrid" suffix="Requires 6 core abilities" />
          </div>
          {specialisations.map((cls) => (
            <OptRow
              key={cls.id}
              name={cls.name}
              desc={classDescription(cls)}
              active={cls.id === selectedClassId}
              onClick={() => onSelect(cls.id)}
            />
          ))}
        </>
      )}
    </div>
  )
}

type ClassDetailProps = {
  selectedClass: SURefClass | undefined
}

/**
 * Detail pane for the Class step (design §3.2c): the selected class's full
 * entity card with its ability trees expanded inside the card (TreeSep
 * headers + head-mode ability cards in 3-col core / 2-col special grids —
 * ClassAbilityTree implements exactly that layout).
 */
export function ClassDetail({ selectedClass }: ClassDetailProps) {
  if (!selectedClass) {
    return (
      <EmptyState
        className="h-full"
        headline="No Class Selected"
        body="Select a class to preview its ability trees."
      />
    )
  }
  return (
    <ReferenceEntityCard
      data={selectedClass as unknown as SURefEntity}
      afterExtraContent={<ClassAbilityTree classEntity={selectedClass} />}
    />
  )
}
