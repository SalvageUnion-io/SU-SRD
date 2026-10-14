import { getCatalogBg, getCatalogLabel } from '../../catalog/catalogColors'
import type { Story } from '../../stories/_harness'
import '../../stories/_stories.css'
import { CatalogTile } from './CatalogTile'

export default {
  title: 'Atoms/Catalog Tile',
}

const noop = () => {}

/**
 * The Dashboard SRD Explorer's catalog tile (canonical). Tile fill comes from
 * the caller's `catalogBg` (here the real `getCatalogBg`); a gradient tile
 * (Systems on the tech-level ramp, Abilities on the tiers) takes the real
 * `getCatalogLabel` paper chip under its name.
 */
const TILES = ['chassis', 'classes', 'crawlers', 'systems', 'abilities', 'npcs'] as const

export const Default: Story = () => (
  <div className="su-story-catalog-grid">
    {TILES.map((schemaId) => (
      <CatalogTile
        key={schemaId}
        onActivate={noop}
        name={schemaId}
        catalogBg={getCatalogBg(schemaId)}
        catalogLabel={getCatalogLabel(schemaId)}
      />
    ))}
  </div>
)
