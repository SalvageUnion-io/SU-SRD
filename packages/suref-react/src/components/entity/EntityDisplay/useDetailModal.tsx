import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SURefEntity, SURefObjectPatternSystemModule } from 'salvageunion-reference'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { EntityDisplayContent } from './components/EntityDisplayContent'
import { DetailIcon } from './DetailIcon'
import type { EntityControl } from './entityControlTypes'

type UseDetailModalOptions = {
  patternOverride?: {
    name: string
    systems: SURefObjectPatternSystemModule[]
    modules: SURefObjectPatternSystemModule[]
  }
  children?: ReactNode
  label?: string
  /** Controls to render in the modal's entity header */
  modalControls?: EntityControl[]
}

export function useDetailModal(
  data: SURefEntity | undefined,
  options?: UseDetailModalOptions
): {
  control: EntityControl
  modal: ReactNode
} {
  const [open, setOpen] = useState(false)

  const schemaName =
    data && 'schemaName' in data && typeof data.schemaName === 'string'
      ? (data.schemaName as Parameters<typeof EntityDisplayContent>[0]['schemaName'])
      : undefined

  const title =
    data && 'name' in data && typeof data.name === 'string' ? data.name : 'Entity details'

  const control: EntityControl = {
    key: 'detail',
    icon: DetailIcon,
    onClick: () => setOpen(true),
    ariaLabel: 'View details',
    variant: 'ghost',
  }

  const modal =
    data && schemaName ? (
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <DialogPrimitive.Content className="relative w-full max-w-6xl bg-transparent outline-none">
                <DialogPrimitive.Close className="fixed top-4 right-4 z-[60] rounded-full bg-su-black/70 p-2 text-su-white opacity-70 transition-opacity hover:opacity-100">
                  <X className="h-6 w-6" aria-hidden="true" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
                <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Entity display details
                </DialogPrimitive.Description>
                <EntityDisplayContent
                  data={data}
                  schemaName={schemaName}
                  compact={false}
                  listing={false}
                  dimHeader={false}
                  disabled={false}
                  hideActions={false}
                  hidePatterns={!!options?.patternOverride}
                  hideChoices={false}
                  patternOverride={options?.patternOverride}
                  controls={options?.modalControls}
                  label={
                    schemaName === 'abilities' && 'tree' in data && data.tree
                      ? `${data.tree} Tree`
                      : options?.label
                  }
                >
                  {options?.children}
                </EntityDisplayContent>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Overlay>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    ) : null

  return { control, modal }
}
