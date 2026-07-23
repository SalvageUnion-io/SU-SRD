import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { EntityDetailDialog } from './EntityDetailDialog'
import { ReferenceEntityCard } from './card/ReferenceEntityCard'
import type { ReferenceEntityCardHideConfig } from './card/ReferenceEntityCard'
import { DetailIcon } from './DetailIcon'
import { useEntityHref, useEntityDetailLink } from './entityHrefContext'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'
import type { StatItem } from '../shared/statsBarTypes'

type UseDetailModalOptions = {
  children?: ReactNode
  /** Controls to render in the modal's entity header */
  modalControls?: ReferenceEntityControl[]
  /** Generic override props */
  titleOverride?: string
  subtitleExtra?: ReactNode
  statsOverride?: StatItem[]
  primaryStatsOnly?: boolean
  abilitiesSection?: ReactNode
  afterExtraContent?: ReactNode
  afterChoicesContent?: ReactNode
  footerOverride?: ReactNode
  hide?: Partial<ReferenceEntityCardHideConfig>
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

  // When the consuming app opts into link mode (srd) and the entity
  // resolves to an href, "View details" navigates to the entity's show page in
  // a new tab instead of opening the in-place modal. ITUN leaves link mode off,
  // so it keeps the modal (its href would deep-link out to srd).
  const href = useEntityHref(data)
  const linkMode = useEntityDetailLink()
  const openInNewTab = !options?.forceModal && linkMode && !!href

  const schemaName =
    data && 'schemaName' in data && typeof data.schemaName === 'string'
      ? data.schemaName
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
      <EntityDetailDialog open={open} onOpenChange={setOpen} title={title}>
        <ReferenceEntityCard
          data={data}
          disabled={false}
          hide={options?.hide}
          controls={options?.modalControls}
          titleOverride={options?.titleOverride}
          subtitleExtra={options?.subtitleExtra}
          statsOverride={options?.statsOverride}
          primaryStatsOnly={options?.primaryStatsOnly}
          abilitiesSection={options?.abilitiesSection}
          afterExtraContent={options?.afterExtraContent}
          afterChoicesContent={options?.afterChoicesContent}
          footerOverride={options?.footerOverride}
        />
        {options?.children}
      </EntityDetailDialog>
    ) : null

  return { control, modal }
}
