import type { SURefChassis } from 'salvageunion-reference'
import { getModuleSlots } from 'salvageunion-reference'
import { useHydratedMech } from '../../hooks/mech'
import { useManageMechSystemsAndModules } from '../../hooks/mech/useManageMechSystemsAndModules'
import { MechEntityList } from './MechEntityList'

interface ModulesListProps {
  id: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Hides add/remove buttons when viewing another player's sheet */
  readOnly?: boolean
}

export function ModulesList({ id, disabled = false, readOnly = false }: ModulesListProps) {
  const { modules, selectedChassis, usedModuleSlots } = useHydratedMech(id)
  const chassisRef = selectedChassis?.ref as SURefChassis | undefined
  const totalModuleSlots = chassisRef ? (getModuleSlots(chassisRef) ?? 0) : 0
  const { handleRemoveModule, handleAddModule } = useManageMechSystemsAndModules(id)
  return (
    <MechEntityList
      title="Modules"
      schemaName="modules"
      entities={modules}
      usedSlots={usedModuleSlots}
      totalSlots={totalModuleSlots}
      onRemove={readOnly ? undefined : handleRemoveModule}
      onAdd={readOnly ? undefined : handleAddModule}
      disabled={disabled}
      readOnly={readOnly}
    />
  )
}
