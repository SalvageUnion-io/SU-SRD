import type { SURefClass, SURefEntity } from 'salvageunion-reference'
import { ClassAbilityTreeDisplay, OptRow, ReferenceEntityDisplay } from 'suref-react'
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
          <p className="mb-2 mt-5 font-cond text-xs font-bold uppercase tracking-widest text-wk-muted">
            Advanced / Hybrid — requires 6 core abilities
          </p>
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
 * ClassAbilityTreeDisplay implements exactly that layout).
 */
export function ClassDetail({ selectedClass }: ClassDetailProps) {
  if (!selectedClass) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-[3px] border-chrome border-dashed border-wk-faint p-6 text-center text-sm text-wk-muted">
        Select a class to preview its ability trees.
      </div>
    )
  }
  return (
    <ReferenceEntityDisplay
      data={selectedClass as unknown as SURefEntity}
      afterExtraContent={<ClassAbilityTreeDisplay classEntity={selectedClass} />}
    />
  )
}
