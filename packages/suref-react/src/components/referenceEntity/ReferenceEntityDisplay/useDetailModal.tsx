import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { ReferenceEntityDisplayContent } from './components/ReferenceEntityDisplayContent'
import { DetailIcon } from './DetailIcon'
import { useEntityHref, useEntityDetailLink } from './entityHrefContext'
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
  /**
   * Force the in-place modal even when the app enables link mode. Used for
   * views that have no standalone URL (e.g. chassis patterns, whose `data` is
   * the chassis itself) — linking out would just reopen the same page and drop
   * the pattern-specific view. The `EntityDetailLinkProvider` can't cover this:
   * this hook runs in the caller's body, above the provider it wraps its JSX
   * with, so the hook still reads the ambient link mode.
   */
  forceModal?: boolean
}

export function useDetailModal(
  data: SURefEntity | undefined,
  options?: UseDetailModalOptions
): {
  control: ReferenceEntityControl
  modal: ReactNode
} {
  const [open, setOpen] = useState(false)

  // When the consuming app opts into link mode (suref-web) and the entity
  // resolves to an href, "View details" navigates to the entity's show page in
  // a new tab instead of opening the in-place modal. ITUN leaves link mode off,
  // so it keeps the modal (its href would deep-link out to suref-web).
  const href = useEntityHref(data)
  const linkMode = useEntityDetailLink()
  const openInNewTab = !options?.forceModal && linkMode && !!href

  const schemaName =
    data && 'schemaName' in data && typeof data.schemaName === 'string'
      ? (data.schemaName as Parameters<typeof ReferenceEntityDisplayContent>[0]['schemaName'])
      : undefined

  const title =
    data && 'name' in data && typeof data.name === 'string' ? data.name : 'Entity details'

  const control: ReferenceEntityControl = {
    key: 'detail',
    icon: DetailIcon,
    onClick: openInNewTab
      ? () => window.open(href, '_blank', 'noopener,noreferrer')
      : () => setOpen(true),
    ariaLabel: 'View details',
    hidden: true,
    cardClick: true,
  }

  const modal =
    !openInNewTab && data && schemaName ? (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
          <Dialog.Popup className="fixed inset-0 z-50 m-auto h-fit w-full max-w-6xl bg-transparent px-3 outline-none">
            {/* Overflow lives on the inner scroll wrapper so the close button
                (a sibling) isn't clipped by it. The scroll wrapper's pt-3 leaves
                room for the floating callout row, which straddles ~8px above the
                card's top edge — without it, overflow-y-auto clips the callout.
                The SRD black-stamp square button is kitty-cornered, straddling the
                card's top-right corner. */}
            <div className="relative">
              <Dialog.Close className="absolute -top-2 -right-2 z-[60] flex h-9 w-9 cursor-pointer items-center justify-center rounded-[3px] border-2 border-su-white bg-su-black text-su-white shadow-lg transition-colors hover:bg-su-orange-dark">
                <X className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </Dialog.Close>
              <div className="max-h-[calc(100vh-4rem)] overflow-y-auto pt-3">
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
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ) : null

  return { control, modal }
}
