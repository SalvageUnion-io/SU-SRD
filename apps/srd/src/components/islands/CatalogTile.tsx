import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityCard } from 'component-lib'

type CatalogTileProps = {
  entity: SURefEntity
  /** Where the tile links. The schema index navigates here; the og:image render
   *  surface never follows it, but keeps it so the markup is identical. */
  href: string
}

/**
 * The Catalog tile — one entity as it appears in a schema index grid.
 *
 * This exists so the schema index (`SchemaViewerIsland`) and the og:image render
 * surface (`OgCardIsland`) cannot drift apart. The social preview for an entity
 * is a screenshot of this component, so "the preview matches the Catalog view"
 * holds because they are the SAME component, not because two call sites happen
 * to pass matching props today.
 *
 * Wrap in `EntityHrefProvider` + `EntityDetailLinkProvider` at the grid level;
 * both render sites do.
 */
export function CatalogTile({ entity, href }: CatalogTileProps) {
  return (
    <a href={href} aria-label={entity.name} className="relative block">
      <ReferenceEntityCard data={entity} size="medium" extent="catalog" cardClickable />
    </a>
  )
}
