import { useContext } from 'react'
import { EntityViewerModalContext } from './EntityViewerModalContext'
import type { EntityViewerModalContextValue } from './EntityViewerModalContext'

/**
 * Hook to access the entity viewer modal.
 * Provides functions to open and close the modal with entity data.
 *
 * @example
 * const { openEntityModal } = useEntityModal()
 * openEntityModal('abilities', 'some-ability-id')
 */
export function useEntityModal(): EntityViewerModalContextValue {
  const context = useContext(EntityViewerModalContext)
  if (!context) {
    throw new Error('useEntityModal must be used within EntityViewerModalProvider')
  }
  return context
}
