import { useState, useCallback } from 'react'

/**
 * Hook to manage wizard creation state and error handling
 * Provides common pattern for all wizard creation flows
 */
export function useWizardCreation<TState>(createFn: (state: TState) => Promise<void>) {
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = useCallback(
    async (state: TState) => {
      setIsCreating(true)
      try {
        await createFn(state)
        // Don't reset isCreating on success - navigation will unmount component
      } catch (error) {
        console.error('Failed to create from wizard:', error)
        setIsCreating(false)
        throw error
      }
    },
    [createFn]
  )

  return {
    isCreating,
    handleCreate,
  }
}
