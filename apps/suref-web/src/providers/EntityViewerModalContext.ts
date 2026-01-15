import { createContext } from 'react'
import type { SURefEnumSchemaName } from 'salvageunion-reference'

export interface EntityViewerModalContextValue {
  openEntityModal: (schemaName: SURefEnumSchemaName, entityId: string) => void
  closeEntityModal: () => void
}

export const EntityViewerModalContext = createContext<EntityViewerModalContextValue | null>(null)
