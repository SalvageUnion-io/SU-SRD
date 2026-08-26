/* Ported from packages/component-lib/src/components/shared/CatalogTile.stories.tsx. */
import { CatalogTile } from 'component-lib'

/**
 * The real gear/tech-level ramp the SRD renders behind the Systems, Equipment,
 * Modules and Drones tiles — six HARD-STOP bands, one per tech level, with no
 * blending between them. Restated rather than imported because component-lib
 * must not depend on an app.
 */
const TECH_LEVEL_RAMP = `linear-gradient(to right, ${[1, 2, 3, 4, 5, 6]
  .map((tl, i, arr) => {
    const start = ((i / arr.length) * 100).toFixed(1)
    const end = (((i + 1) / arr.length) * 100).toFixed(1)
    return `var(--color-tl-${tl}) ${start}%, var(--color-tl-${tl}) ${end}%`
  })
  .join(', ')})`

/**
 * The SRD landing / 404 catalog-tile link. Tile fill comes from the caller's
 * `catalogBg`; an optional `catalogLabel` renders the name as a filled chip,
 * which the reference site uses for grouped sub-categories.
 */
export function Catalog() {
  return (
    <div className="grid max-w-3xl grid-cols-2 gap-3 bg-paper p-4 sm:grid-cols-3">
      <CatalogTile href="/schema/chassis" name="Chassis" catalogBg="var(--color-mech)" />
      <CatalogTile href="/schema/pilots" name="Pilots" catalogBg="var(--color-pilot)" />
      <CatalogTile href="/schema/crawlers" name="Crawlers" catalogBg="var(--color-crawler)" />
      <CatalogTile
        href="/schema/systems"
        name="Systems"
        catalogBg={TECH_LEVEL_RAMP}
        catalogLabel="var(--color-mech-dark)"
      />
      <CatalogTile
        href="/schema/npcs"
        name="NPCs"
        catalogBg="var(--color-ink)"
        catalogLabel="var(--color-rust)"
      />
      <CatalogTile href="/" name="Return to Home" variant="ghost" />
    </div>
  )
}
