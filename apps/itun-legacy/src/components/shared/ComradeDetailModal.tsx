import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { Dialog } from '@base-ui/react/dialog'
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
        <Dialog.Popup className="fixed inset-0 z-50 mx-auto mt-8 mb-auto h-fit max-h-[calc(100vh-4rem)] w-full max-w-3xl overflow-y-auto bg-transparent outline-none">
          <Dialog.Title className="sr-only">{name}</Dialog.Title>
          <Dialog.Description className="sr-only">{name}</Dialog.Description>

          <Dialog.Close className="absolute -top-3 -right-3 z-10 flex cursor-pointer items-center justify-center rounded-full bg-su-black p-1.5 text-su-white/80 shadow-md transition-colors hover:bg-su-black/80 hover:text-su-white">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>

          <SubEntityCard
            entity={comradeEntity}
            mechId={mechId}
            mechRefs={mechRefs}
            readOnly
            compact={false}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
