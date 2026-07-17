import type { Story } from '@ladle/react'
import { CatalogTile } from './CatalogTile'

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
      catalogBg="linear-gradient(135deg, var(--color-su-orange-dark), var(--color-su-rust))"
    />
    <CatalogTile
      href="/schema/npcs"
      name="NPCs"
      catalogBg="var(--color-ink)"
      catalogLabel="var(--color-su-orange-dark)"
    />
  </div>
)
