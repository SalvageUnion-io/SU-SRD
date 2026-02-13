import { SalvageUnionReference, getModel } from 'salvageunion-reference'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog'
import { EntityDisplay } from './EntityDisplay'
import type { ClassAbilitiesRenderer } from './EntityDisplay/entityDisplayTypes'
import { NotFoundDisplay } from './NotFoundDisplay'

type EntityDisplayModalProps = {
  isOpen: boolean
  onClose: () => void
  schemaName: SURefEnumSchemaName | null
  entityId: string | null
  classAbilitiesRenderer?: ClassAbilitiesRenderer
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
  classAbilitiesRenderer,
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-6xl border-none bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">
          {entity ? ('name' in entity ? String(entity.name) : 'Entity Details') : 'Not Found'}
        </DialogTitle>
        <DialogDescription className="sr-only">Entity display details</DialogDescription>
        {entity ? (
          <EntityDisplay data={entity} classAbilitiesRenderer={classAbilitiesRenderer} />
        ) : (
          <NotFoundDisplay
            entityType={schemaDisplayName}
            entityId={entityId || undefined}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
