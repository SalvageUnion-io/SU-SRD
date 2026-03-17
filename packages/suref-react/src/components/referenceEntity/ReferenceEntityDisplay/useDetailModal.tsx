import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { ReferenceEntityDisplayContent } from './components/ReferenceEntityDisplayContent'
import { DetailIcon } from './DetailIcon'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'
import type { ReferenceEntityHideConfig } from './referenceEntityDisplayTypes'

type UseDetailModalOptions = {
  children?: ReactNode
  label?: string
  /** Controls to render in the modal's entity header */
  modalControls?: ReferenceEntityControl[]
  /** Generic override props */
  titleOverride?: string
  subtitleExtra?: ReactNode
  statsOverride?: { value: number; bottomLabel: string }
  primaryStatsOnly?: boolean
  abilitiesSection?: ReactNode
  afterExtraContent?: ReactNode
  afterChoicesContent?: ReactNode
  footerOverride?: ReactNode
  hide?: Partial<ReferenceEntityHideConfig>
}

export function useDetailModal(
  data: SURefEntity | undefined,
  options?: UseDetailModalOptions
): {
  control: ReferenceEntityControl
  modal: ReactNode
} {
  const [open, setOpen] = useState(false)

  const schemaName =
    data && 'schemaName' in data && typeof data.schemaName === 'string'
      ? (data.schemaName as Parameters<typeof ReferenceEntityDisplayContent>[0]['schemaName'])
      : undefined

  const title =
    data && 'name' in data && typeof data.name === 'string' ? data.name : 'Entity details'

  const control: ReferenceEntityControl = {
    key: 'detail',
    icon: DetailIcon,
    onClick: () => setOpen(true),
    ariaLabel: 'View details',
    hidden: true,
    cardClick: true,
  }

  const modal =
    data && schemaName ? (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
          <Dialog.Popup className="fixed inset-0 z-50 m-auto h-fit max-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-y-auto bg-transparent outline-none">
            <div className="relative">
              <Dialog.Close className="absolute -top-2 -right-2 z-[60] rounded-full bg-su-black/70 p-2 text-su-white opacity-70 transition-opacity hover:opacity-100 cursor-pointer">
                <X className="h-6 w-6" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              <Dialog.Description className="sr-only">Entity display details</Dialog.Description>
              <ReferenceEntityDisplayContent
                data={data}
                schemaName={schemaName}
                compact={false}
                listing={false}
                dimHeader={false}
                disabled={false}
                hide={options?.hide}
                controls={options?.modalControls}
                label={
                  schemaName === 'abilities' && 'tree' in data && data.tree
                    ? `${data.tree} Tree`
                    : options?.label
                }
                titleOverride={options?.titleOverride}
                subtitleExtra={options?.subtitleExtra}
                statsOverride={options?.statsOverride}
                primaryStatsOnly={options?.primaryStatsOnly}
                abilitiesSection={options?.abilitiesSection}
                afterExtraContent={options?.afterExtraContent}
                afterChoicesContent={options?.afterChoicesContent}
                footerOverride={options?.footerOverride}
              >
                {options?.children}
              </ReferenceEntityDisplayContent>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ) : null

  return { control, modal }
}
