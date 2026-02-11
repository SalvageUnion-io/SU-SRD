import { useContext } from 'react'
import { EntityDisplayContext } from './entityDisplayContext'

/**
 * Hook to access EntityDisplay context
 * @throws Error if used outside EntityDisplayProvider
 */
export function useEntityDisplayContext() {
  const context = useContext(EntityDisplayContext)
  if (!context) {
    throw new Error('useEntityDisplayContext must be used within EntityDisplayProvider')
  }
  return context
}
