import { useMemo } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityPickerModal } from '../shared/EntityPickerModal'

export type BuilderSchemaName = 'chassis' | 'systems' | 'modules'

type EntitySelectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  schemaName: BuilderSchemaName
  onSelect: (entityId: string) => void
  filter?: (entity: { id: string; name: string }) => boolean
  remainingSlots?: number
  remainingBudget?: number
}

function getEntities(schemaName: BuilderSchemaName): SURefEntity[] {
  switch (schemaName) {
    case 'chassis':
      return SalvageUnionReference.Chassis.all()
    case 'systems':
      return SalvageUnionReference.Systems.all()
    case 'modules':
      return SalvageUnionReference.Modules.all()
  }
}

export function EntitySelectionModal({
  open,
  onOpenChange,
  title,
  schemaName,
  onSelect,
  filter,
  remainingSlots,
  remainingBudget,
}: EntitySelectionModalProps) {
  const entities = useMemo(() => getEntities(schemaName), [schemaName])

  const singularName = schemaName === 'chassis' ? 'chassis' : schemaName.slice(0, -1)
  const slotsLabel =
    remainingSlots !== undefined
      ? ` (${remainingSlots} slot${remainingSlots !== 1 ? 's' : ''} remaining)`
      : ''

  return (
    <EntityPickerModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={`Select a ${singularName} to add.${slotsLabel}`}
      entities={entities}
      onSelect={onSelect}
      filter={filter}
      remainingSlots={remainingSlots}
      remainingBudget={remainingBudget}
      closeOnSelect
    />
  )
}
