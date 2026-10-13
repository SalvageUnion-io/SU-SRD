import { getCatalogBg } from '../../catalog/catalogColors'
import type { Story } from '../../stories/_harness'
import '../../stories/_stories.css'
import { CatalogTile } from './CatalogTile'

export default {
  title: 'Atoms/Catalog Tile',
}

const noop = () => {}

/**
 * The Dashboard SRD Explorer's catalog tile (canonical). Tile fill comes from
 * the caller's `catalogBg` (here the real `getCatalogBg` ramps, Systems on the
 * tech-level hard-stop bands); an optional `catalogLabel` renders the name as
 * a filled chip (grouped sub-categories use this).
 */
export const Default: Story = () => (
  <div className="su-story-catalog-grid">
    <CatalogTile onActivate={noop} name="Chassis" catalogBg="var(--color-mech)" />
    <CatalogTile onActivate={noop} name="Pilots" catalogBg="var(--color-pilot)" />
    <CatalogTile onActivate={noop} name="Crawlers" catalogBg="var(--color-crawler)" />
    <CatalogTile
      onActivate={noop}
      name="Systems"
      catalogBg={getCatalogBg('systems')}
      catalogLabel="var(--color-mech-dark)"
    />
    <CatalogTile
      onActivate={noop}
      name="NPCs"
      catalogBg="var(--color-ink)"
      catalogLabel="var(--color-adversary)"
    />
  </div>
)
