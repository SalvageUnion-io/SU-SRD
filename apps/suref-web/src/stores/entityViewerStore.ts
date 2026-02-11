import { create } from 'zustand'
import type { SURefEnumSchemaName } from 'salvageunion-reference'

type EntityViewerState = {
  isOpen: boolean
  schemaName: SURefEnumSchemaName | null
  entityId: string | null
  openEntityModal: (schemaName: SURefEnumSchemaName, entityId: string) => void
  closeEntityModal: () => void
}

export const useEntityViewerStore = create<EntityViewerState>((set) => ({
  isOpen: false,
  schemaName: null,
  entityId: null,
  openEntityModal: (schemaName, entityId) => set({ isOpen: true, schemaName, entityId }),
  closeEntityModal: () => {
    set({ isOpen: false })
    // Delay clearing schema/entity to allow close animation
    setTimeout(() => {
      set({ schemaName: null, entityId: null })
    }, 300)
  },
}))
