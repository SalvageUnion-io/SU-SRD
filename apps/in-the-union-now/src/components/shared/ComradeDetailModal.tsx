import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { SubEntityCard } from './SubEntityCard'
import type { EntityRefRow } from '../../types/common'

type ComradeDetailModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  comradeEntity: SURefEntity & { schemaName: SURefEnumSchemaName }
  mechId?: string
  mechRefs?: EntityRefRow[]
}

export function ComradeDetailModal({
  open,
  onOpenChange,
  comradeEntity,
  mechId,
  mechRefs,
}: ComradeDetailModalProps) {
  const name =
    'name' in comradeEntity && typeof comradeEntity.name === 'string'
      ? comradeEntity.name
      : 'Comrade'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex min-h-full w-full items-start justify-center px-4 py-8">
            <DialogPrimitive.Content className="relative w-full max-w-3xl outline-none">
              <DialogPrimitive.Title className="sr-only">{name}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">{name}</DialogPrimitive.Description>

              <DialogPrimitive.Close className="absolute -top-3 -right-3 z-10 flex cursor-pointer items-center justify-center rounded-full bg-su-black p-1.5 text-su-white/80 shadow-md transition-colors hover:bg-su-black/80 hover:text-su-white">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>

              <SubEntityCard
                entity={comradeEntity}
                mechId={mechId}
                mechRefs={mechRefs}
                readOnly
                compact={false}
              />
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
