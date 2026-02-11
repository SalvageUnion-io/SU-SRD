import { EntityDisplayModal } from 'suref-react'
import { useEntityViewerStore } from '../../stores/entityViewerStore'

export function EntityModalIsland() {
  const { isOpen, schemaName, entityId, closeEntityModal } = useEntityViewerStore()
  return (
    <EntityDisplayModal
      isOpen={isOpen}
      onClose={closeEntityModal}
      schemaName={schemaName}
      entityId={entityId}
    />
  )
}
