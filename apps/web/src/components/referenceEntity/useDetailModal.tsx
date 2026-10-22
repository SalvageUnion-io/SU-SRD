import type { ReactNode } from 'react'
import { useState } from 'react'
import type { RefEntity, RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { entityRef } from 'salvageunion-reference'
import { useEntitySurface } from '../entity/entitySurfaceContext'
import { ReferenceEntityCard } from './card/ReferenceEntityCard'
import { DetailIcon } from './DetailIcon'
import { EntityDetailDialog } from './EntityDetailDialog'
import { quotePatternName } from './pattern/quotePatternName'
import type { ReferenceEntityControl } from './referenceEntityControlTypes'

type UseDetailModalOptions = {
  /**
   * Force the in-place modal even where the surface has a route for the
   * entity. Used for views that have no standalone URL (e.g. chassis patterns,
   * whose `data` is the chassis itself) — linking out would just reopen the
   * same page and drop the pattern-specific view. A surface provider can't
   * cover this: this hook runs in the caller's body, above the provider it
   * wraps its JSX with, so the hook still reads the ambient surface.
   */
  forceModal?: boolean
  /** Open the card in its PATTERN view: `data` is the pattern's host. */
  pattern?: RefObjectAnyPattern
}

export function useDetailModal(
  data: RefEntity | undefined,
  options?: UseDetailModalOptions
): {
  control: ReferenceEntityControl
  modal: ReactNode
} {
  const [open, setOpen] = useState(false)

  // Where the surface has a route for the entity (the reference site's `hrefFor`), "View
  // details" goes to the entity's show page, in this tab (EDL E5: the detail
  // view is a Page, never a new-tab `window.open`), instead of opening the
  // in-place modal. The app's surface has no routes, so it keeps the modal.
  const { hrefFor } = useEntitySurface()
  const href = data ? hrefFor(entityRef(data as RefMetaEntity)) : undefined
  const linksOut = !options?.forceModal && href !== undefined

  const schemaName =
    data && 'schemaName' in data && typeof data.schemaName === 'string'
      ? data.schemaName
      : undefined

  // The Page's title: a pattern's quoted name, else the entity's.
  const name =
    data && 'name' in data && typeof data.name === 'string' ? data.name : 'Entity details'
  const title = options?.pattern ? quotePatternName(options.pattern.name) : name

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
      // The detail view is the Page (EDL Form 5, E5): the dialog draws its band
      // and foot, the card at `presentation="page"` its body.
      <EntityDetailDialog
        open={open}
        onOpenChange={setOpen}
        entity={data as RefMetaEntity}
        pattern={options?.pattern}
        title={title}
      >
        <ReferenceEntityCard
          data={data}
          pattern={options?.pattern}
          presentation="page"
          disabled={false}
        />
      </EntityDetailDialog>
    ) : null

  return { control, modal }
}
