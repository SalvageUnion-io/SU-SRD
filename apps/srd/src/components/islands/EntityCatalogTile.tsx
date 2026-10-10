import { ReferenceEntityCard } from 'component-lib'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'

type EntityCatalogTileProps = {
  entity: SURefEntity
  /** Where the tile links: the schema index navigates here. */
  href: string
  /** Render one of `entity`'s patterns (chassis only) as the subject instead of
   *  the chassis itself — the pattern is its own kind of entity, with its own
   *  page, card view and provenance, so it gets its own tile. */
  pattern?: SURefObjectPattern
}

/**
 * The entity Catalog tile — one entity as it appears in a schema index grid.
 *
 * Named `EntityCatalogTile`, not `CatalogTile`, because component-lib exports a
 * `CatalogTile` too (the landing-page category tile) and srd renders both.
 *
 * The social preview was a screenshot of this tile until the link previews got
 * their own card (`OgCard`, issue 1280); the schema index is its one render
 * site now.
 *
 * Wrap in `EntityHrefProvider` + `EntityDetailLinkProvider` at the grid level.
 */
export function EntityCatalogTile({ entity, href, pattern }: EntityCatalogTileProps) {
  return (
    <a href={href} aria-label={pattern?.name ?? entity.name} className="relative block">
      <ReferenceEntityCard
        data={entity}
        pattern={pattern}
        size="medium"
        extent="catalog"
        cardClickable
      />
    </a>
  )
}
