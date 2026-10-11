import { ReferenceEntityCard } from 'component-lib'
import type { ComponentProps } from 'react'
import type { SURefEntity } from 'salvageunion-reference'

type EntityListingRowProps = {
  entity: SURefEntity
  /** The entity's own page. */
  href: string
  /** What the listing's context already says (the seam stamp, a grouped-by cell). */
  hide?: ComponentProps<typeof ReferenceEntityCard>['hide']
  /** Keep the art column when this entity has none (others in the listing do). */
  artSlot?: boolean
}

/**
 * One entity in a schema listing's default view (ruleset §1, Listing: "one
 * card, one click"): the compact card, `size="medium" extent="head"`, as a link
 * to the entity's page. Its head carries the name (wrapping to two lines before
 * it clamps), its body the value cells and the "//" line, its art column the
 * artwork where the entity has some.
 *
 * The anchor carries the interaction and the accessible name; the card takes
 * `cardClickable` for its hover affordance only, as `EntityCatalogTile` does.
 */
export function EntityListingRow({ entity, href, hide, artSlot }: EntityListingRowProps) {
  return (
    <a href={href} aria-label={entity.name} className="srd-listing__row">
      <ReferenceEntityCard
        data={entity}
        size="medium"
        extent="head"
        hide={hide}
        artSlot={artSlot}
        cardClickable
      />
    </a>
  )
}
