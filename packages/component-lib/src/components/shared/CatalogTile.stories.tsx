import type { Story } from '@ladle/react'
import { CatalogTile } from './CatalogTile'

/**
 * The real gear/tech-level ramp the SRD renders behind the Systems, Equipment,
 * Modules and Drones tiles — six HARD-STOP bands, one per tech level, with no
 * blending between them.
 *
 * Mirrors `getCatalogBg`'s `techLevelBg` in `apps/srd/src/lib/catalogColors.ts`;
 * it is restated rather than imported because component-lib must not depend on
 * an app. The story previously invented a smooth `135deg` rust→adversary blend,
 * which no page has ever rendered — a made-up value that also read as shading
 * rather than the banded wayfinding cue this actually is.
 */
const TECH_LEVEL_RAMP = `linear-gradient(to right, ${[1, 2, 3, 4, 5, 6]
  .map((tl, i, arr) => {
    const start = ((i / arr.length) * 100).toFixed(1)
    const end = (((i + 1) / arr.length) * 100).toFixed(1)
    return `var(--color-tl-${tl}) ${start}%, var(--color-tl-${tl}) ${end}%`
  })
  .join(', ')})`

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Catalog Tile',
}

/**
 * The SRD landing/404 catalog-tile link (canonical). Tile fill comes from the
 * caller's `catalogBg`; an optional
 * `catalogLabel` renders the name as a filled chip (the reference site uses this
 * for grouped sub-categories).
 */
export const Default: Story = () => (
  <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
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
  </div>
)
