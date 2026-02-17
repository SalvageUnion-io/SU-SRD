import type { SURefEntity } from 'salvageunion-reference'
import { EntityDisplay } from 'suref-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

type BayDetailOverlayProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: SURefEntity | undefined
  mode: 'content' | 'damage'
}

export function BayDetailOverlay({
  open,
  onOpenChange,
  entity,
  mode,
}: BayDetailOverlayProps) {
  if (!entity) return null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex min-h-full items-start justify-center px-4 py-8">
            <DialogPrimitive.Content className="relative w-full max-w-2xl bg-transparent outline-none">
              <DialogPrimitive.Title className="sr-only">
                {entity.name} — {mode === 'content' ? 'Details' : 'Damaged Effect'}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                {mode === 'content' ? 'Bay details.' : 'Bay damaged effect information.'}
              </DialogPrimitive.Description>

              <div className="relative">
                <DialogPrimitive.Close className="absolute top-2 right-2 z-20 flex shrink-0 cursor-pointer items-center justify-center rounded p-1 text-su-white/60 transition-colors hover:bg-su-black/20 hover:text-su-white">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>

                <EntityDisplay
                  data={entity}
                  compact={false}
                  damaged={mode === 'damage'}
                  hideActions={mode === 'damage'}
                  hideContent={mode === 'damage'}
                />
              </div>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
