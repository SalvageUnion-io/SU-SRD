import { useState } from 'react'
import { Button } from '@chakra-ui/react'
import { logger } from '../../lib/logger'

interface DeleteButtonProps {
  entityName: string
  onConfirmDelete: () => void | Promise<void>
  disabled?: boolean
}

/**
 * Delete button component for entity cards
 * Shows a confirmation dialog before executing the delete action
 * Displays "DELETE THIS <entityName>" text
 */
export function DeleteButton({ entityName, onConfirmDelete, disabled = false }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click

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
      bg="brand.srd"
      color="su.white"
      fontWeight="bold"
      borderRadius="md"
      borderWidth="2px"
      borderColor="su.black"
      px={3}
      py={1.5}
      fontSize="xs"
      minW="auto"
      h="auto"
      _hover={{ opacity: 0.9 }}
      _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
      onClickCapture={(e) => e.stopPropagation()}
    >
      {isDeleting ? 'Deleting...' : `DELETE THIS ${entityName.toUpperCase()}`}
    </Button>
  )
}
