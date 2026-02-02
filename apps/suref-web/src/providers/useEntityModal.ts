import { useEntityViewerStore } from '../stores/entityViewerStore'

/**
 * Hook to access the entity viewer modal.
 * Provides functions to open and close the modal with entity data.
 *
 * @example
 * const { openEntityModal } = useEntityModal()
 * openEntityModal('abilities', 'some-ability-id')
 */
export function useEntityModal() {
  const openEntityModal = useEntityViewerStore((state) => state.openEntityModal)
  const closeEntityModal = useEntityViewerStore((state) => state.closeEntityModal)

  return { openEntityModal, closeEntityModal }
}
