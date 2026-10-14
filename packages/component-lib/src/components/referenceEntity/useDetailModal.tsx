import type { ReactNode } from 'react'
import { useState } from 'react'
import type { SURefEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { ReferenceEntityCard } from './card/ReferenceEntityCard'
import { DetailIcon } from './DetailIcon'
import { EntityDetailDialog } from './EntityDetailDialog'
import { useEntityDetailLink, useEntityHref } from './entityHrefContext'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'

type UseDetailModalOptions = {
  /**
   * Force the in-place modal even when the app enables link mode. Used for
   * views that have no standalone URL (e.g. chassis patterns, whose `data` is
   * the chassis itself) — linking out would just reopen the same page and drop
   * the pattern-specific view. The `EntityDetailLinkProvider` can't cover this:
   * this hook runs in the caller's body, above the provider it wraps its JSX
   * with, so the hook still reads the ambient link mode.
   */
  forceModal?: boolean
  /** Open the card in its PATTERN view: `data` is the pattern's host. */
  pattern?: SURefObjectAnyPattern
}

export function useDetailModal(
  data: SURefEntity | undefined,
  options?: UseDetailModalOptions
): {
  control: ReferenceEntityControl
  modal: ReactNode
} {
  const [open, setOpen] = useState(false)

  // When the consuming app opts into link mode (srd) and the entity
  // resolves to an href, "View details" goes to the entity's show page, in
  // this tab (EDL E5: the detail view is a Page, never a new-tab
  // `window.open`), instead of opening the in-place modal. ITUN leaves link
  // mode off, so it keeps the modal (its href would deep-link out to srd).
  const href = useEntityHref(data)
  const linkMode = useEntityDetailLink()
  const linksOut = !options?.forceModal && linkMode && !!href

  const schemaName =
    data && 'schemaName' in data && typeof data.schemaName === 'string'
      ? data.schemaName
      : undefined

  const title =
    data && 'name' in data && typeof data.name === 'string' ? data.name : 'Entity details'

  const control: ReferenceEntityControl = {
    key: 'detail',
    icon: DetailIcon,
    onClick: linksOut ? () => window.location.assign(href) : () => setOpen(true),
    ariaLabel: 'View details',
    hidden: true,
    cardClick: true,
  }

  const modal =
    !linksOut && data && schemaName ? (
      <EntityDetailDialog open={open} onOpenChange={setOpen} title={title}>
        <ReferenceEntityCard data={data} pattern={options?.pattern} disabled={false} />
      </EntityDetailDialog>
    ) : null

  return { control, modal }
}
