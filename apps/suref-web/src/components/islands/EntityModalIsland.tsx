import { EntityDisplayModal } from 'suref-react'
import { useEntityViewerStore } from '../../stores/entityViewerStore'
import { classAbilitiesRenderer } from './classAbilitiesRenderer'

export function EntityModalIsland() {
  const { isOpen, schemaName, entityId, closeEntityModal } = useEntityViewerStore()
  return (
    <EntityDisplayModal
      isOpen={isOpen}
      onClose={closeEntityModal}
      schemaName={schemaName}
      entityId={entityId}
      classAbilitiesRenderer={classAbilitiesRenderer}
    />
  )
}
