import type { SURefChassis } from 'salvageunion-reference'
import { getSystemSlots } from 'salvageunion-reference'
import { useHydratedMech } from '../../hooks/mech'
import { useManageMechSystemsAndModules } from '../../hooks/mech/useManageMechSystemsAndModules'
import { MechEntityList } from './MechEntityList'

interface SystemsListProps {
  id: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Hides add/remove buttons when viewing another player's sheet */
  readOnly?: boolean
}

export function SystemsList({ id, disabled = false, readOnly = false }: SystemsListProps) {
  const { systems, selectedChassis, usedSystemSlots } = useHydratedMech(id)
  const chassisRef = selectedChassis?.ref as SURefChassis | undefined
  const totalSystemSlots = chassisRef ? (getSystemSlots(chassisRef) ?? 0) : 0
  const { handleRemoveSystem, handleAddSystem } = useManageMechSystemsAndModules(id)

  return (
    <MechEntityList
      title="Systems"
      schemaName="systems"
      entities={systems}
      usedSlots={usedSystemSlots}
      totalSlots={totalSystemSlots}
      onRemove={readOnly ? undefined : handleRemoveSystem}
      onAdd={readOnly ? undefined : handleAddSystem}
      disabled={disabled}
      readOnly={readOnly}
    />
  )
}
