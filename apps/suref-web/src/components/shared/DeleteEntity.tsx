import { useState } from 'react'
import { Button } from '@chakra-ui/react'
import { logger } from '../../lib/logger'

interface DeleteEntityProps {
  entityName: string
  onConfirmDelete: () => void | Promise<void>
  disabled?: boolean
}

/**
 * Reusable delete button component for entities
 * Shows a confirmation dialog before executing the delete action
 */
export function DeleteEntity({ entityName, onConfirmDelete, disabled = false }: DeleteEntityProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleClick = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${entityName}? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      setIsDeleting(true)
      await onConfirmDelete()
    } catch (error) {
      logger.error(`Error deleting ${entityName}:`, error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isDeleting}
      border="su.black"
      borderWidth="3px"
      borderColor="su.black"
      bg="brand.srd"
      color="su.white"
      w="full"
      fontWeight="bold"
      borderRadius="md"
      py={3}
      _hover={{ opacity: 0.9 }}
      _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
    >
      {isDeleting ? `Deleting ${entityName}...` : `Delete ${entityName}`}
    </Button>
  )
}
