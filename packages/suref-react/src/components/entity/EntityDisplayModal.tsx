import { SalvageUnionReference, getModel } from 'salvageunion-reference'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import {
  DialogRoot,
  DialogContent,
  DialogBackdrop,
  DialogCloseTrigger,
  DialogPositioner,
} from '@chakra-ui/react'
import { EntityDisplay } from './EntityDisplay'
import { NotFoundDisplay } from './NotFoundDisplay'

interface EntityDisplayModalProps {
  isOpen: boolean
  onClose: () => void
  schemaName: SURefEnumSchemaName | null
  entityId: string | null
}

/**
 * Modal that displays an entity using EntityDisplay component.
 * Used for showing detailed entity information when clicking on cargo items.
 */
export function EntityDisplayModal({
  isOpen,
  onClose,
  schemaName,
  entityId,
}: EntityDisplayModalProps) {
  const hasValidData = schemaName && entityId
  const entity = hasValidData ? SalvageUnionReference.get(schemaName, entityId) : null

  // Don't render anything if modal is closed
  if (!isOpen) {
    return null
  }

  // Get display name for the schema type
  const schemaDisplayName = schemaName ? getModel(schemaName)?.displayName : undefined

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => !e.open && onClose()}
      size="xl"
      placement="center"
    >
      <DialogBackdrop bg="blackAlpha.700" />
      <DialogPositioner>
        <DialogContent maxW="6xl" maxH="90vh" bg="transparent" border="none" shadow="none" p={0}>
          <DialogCloseTrigger
            position="absolute"
            top={2}
            right={2}
            color="su.white"
            bg="su.black"
            borderRadius="md"
            _hover={{ bg: 'brand.srd' }}
            fontSize="2xl"
            fontWeight="bold"
            zIndex={10}
            w={10}
            h={10}
          />
          {entity ? (
            <EntityDisplay data={entity} collapsible={false} />
          ) : (
            <NotFoundDisplay
              entityType={schemaDisplayName}
              entityId={entityId || undefined}
              onClose={onClose}
            />
          )}
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  )
}
