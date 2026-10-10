import { ReferenceEntityCard } from 'component-lib'
import type { SURefEntity } from 'salvageunion-reference'

type EntityListingRowProps = {
  entity: SURefEntity
  /** The entity's own page. */
  href: string
}

/**
 * One entity in a schema listing's default view (ruleset §1, Listing: "one
 * line, one click"): the card's header-only row, `size="medium"
 * extent="head"`, as a link to the entity's page. The row never wraps — a
 * long name truncates — so a listing reads as an index.
 *
 * The anchor carries the interaction and the accessible name; the card takes
 * `cardClickable` for its hover affordance only, as `EntityCatalogTile` does.
 */
export function EntityListingRow({ entity, href }: EntityListingRowProps) {
  return (
    <a href={href} aria-label={entity.name} className="srd-listing__row">
      <ReferenceEntityCard data={entity} size="medium" extent="head" cardClickable />
    </a>
  )
}
