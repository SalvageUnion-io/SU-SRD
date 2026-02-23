import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'

type BayDetailOverlayProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: SURefEntity | undefined
  mode: 'content' | 'damage'
}

export function BayDetailOverlay({ open, onOpenChange, entity, mode }: BayDetailOverlayProps) {
  if (!entity) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
        <Dialog.Popup className="fixed inset-0 z-50 mx-auto mt-8 mb-auto h-fit max-h-[calc(100vh-4rem)] w-full max-w-2xl overflow-y-auto bg-transparent outline-none">
          <Dialog.Title className="sr-only">
            {entity.name} — {mode === 'content' ? 'Details' : 'Damaged Effect'}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {mode === 'content' ? 'Bay details.' : 'Bay damaged effect information.'}
          </Dialog.Description>

          <div className="relative">
            <Dialog.Close className="absolute top-2 right-2 z-20 flex shrink-0 cursor-pointer items-center justify-center rounded p-1 text-su-white/60 transition-colors hover:bg-su-black/20 hover:text-su-white">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Dialog.Close>

            <ReferenceEntityDisplay
              data={entity}
              compact={false}
              damaged={mode === 'damage'}
              hide={mode === 'damage' ? { actions: true, content: true } : undefined}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
