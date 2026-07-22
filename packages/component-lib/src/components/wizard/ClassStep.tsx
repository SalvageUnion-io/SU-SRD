import type { SURefClass } from 'salvageunion-reference'
import { EmptyState } from '../chrome/EmptyState'
import { Slab } from '../chrome/Slab'
import { ClassAbilityTree } from '../referenceEntity/ClassAbilityTree'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'

type ClassOptionListProps = {
  base: SURefClass[]
  specialisations: SURefClass[]
  selectedClassId: string
  onSelect: (classId: string) => void
}

/**
 * One selectable class in the master pane: the class's own CATALOG card
 * (artwork + name + description), with the selection layered on as the card's
 * radio affordance — never a bespoke row. `extent="catalog"` is what makes it a
 * pick-list cell rather than a full entity page: the ability trees, actions and
 * choices belong to the detail pane beside it.
 */
function ClassOptionCard({
  cls,
  selected,
  onSelect,
}: {
  cls: SURefClass
  selected: boolean
  onSelect: () => void
}) {
  return (
    <ReferenceEntityCard
      data={cls}
      size="medium"
      extent="catalog"
      className="mb-2"
      selected={selected}
      selectionRole="radio"
      cardClickLabel={cls.name}
      onCardClick={onSelect}
    />
  )
}

/**
 * Master pane for the Class step (design §3.2b): the class's own reference
 * card at catalog extent per option, with Advanced/Hybrid specialisations under
 * their own separator in edit mode. Exactly one is chosen, so the pane is a
 * `radiogroup` and each card announces `aria-checked`.
 */
export function ClassOptionList({
  base,
  specialisations,
  selectedClassId,
  onSelect,
}: ClassOptionListProps) {
  return (
    <div role="radiogroup" aria-label="Class">
      {base.map((cls) => (
        <ClassOptionCard
          key={cls.id}
          cls={cls}
          selected={cls.id === selectedClassId}
          onSelect={() => onSelect(cls.id)}
        />
      ))}
      {specialisations.length > 0 && (
        <>
          <div className="mb-2 mt-5">
            <Slab variant="solid" label="Advanced / Hybrid" count="Requires 6 core abilities" />
          </div>
          {specialisations.map((cls) => (
            <ClassOptionCard
              key={cls.id}
              cls={cls}
              selected={cls.id === selectedClassId}
              onSelect={() => onSelect(cls.id)}
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
 * entity card with its ability trees expanded inside the card (Slab
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
      data={selectedClass}
      afterExtraContent={<ClassAbilityTree classEntity={selectedClass} />}
    />
  )
}
