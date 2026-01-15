import { useState, type ReactNode } from 'react'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { EntityDisplayModal } from '../components/entity/EntityDisplayModal'
import { EntityViewerModalContext } from './EntityViewerModalContext'

interface EntityViewerModalProviderProps {
  children: ReactNode
}

export function EntityViewerModalProvider({ children }: EntityViewerModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [schemaName, setSchemaName] = useState<SURefEnumSchemaName | null>(null)
  const [entityId, setEntityId] = useState<string | null>(null)

  const openEntityModal = (newSchemaName: SURefEnumSchemaName, newEntityId: string) => {
    setSchemaName(newSchemaName)
    setEntityId(newEntityId)
    setIsOpen(true)
  }

  const closeEntityModal = () => {
    setIsOpen(false)

    setTimeout(() => {
      setSchemaName(null)
      setEntityId(null)
    }, 300)
  }

  return (
    <EntityViewerModalContext.Provider value={{ openEntityModal, closeEntityModal }}>
      {children}
      <EntityDisplayModal
        isOpen={isOpen}
        onClose={closeEntityModal}
        schemaName={schemaName}
        entityId={entityId}
      />
    </EntityViewerModalContext.Provider>
  )
}
