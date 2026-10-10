import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { AppBar } from './AppBar'
import { SearchField } from './SearchField'

export default {
  title: 'Compositions/Shell/App Bar',
}

// Real SRD content — reference data is preloaded by catalog.tsx.
const gopher = SalvageUnionReference.Chassis.getByName('Gopher')
const chassisName = gopher?.name ?? 'Gopher'

const STACK = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties

const BUY = 'https://leyline.press/collections/salvage-union'

const srdSearch = (
  <SearchField placeholder="Search the SRD" aria-label="Search the SRD" shortcut="⌘K" />
)

/**
 * The Union bar (board 05) — one lockup, the Reference | Build switcher, the
 * search slot and the product's own nav. The SRD wears the full 64px bar with
 * its breadcrumb trail in the bar (board 07); ITUN wears the compact 48px row
 * with its nav inline (boards 09 and 10). The "here" tab is the inverse stamp,
 * never rust. Narrow the window below 1024px to see the phone shape: the trail
 * moves to its own paper row under the bar.
 */
export const Default: Story = () => (
  <div style={STACK}>
    <div>
      <Caption>SRD · full · an entity page, breadcrumbs in the bar</Caption>
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="https://intheunionnow.com"
        search={srdSearch}
        buyHref={BUY}
        breadcrumbs={[
          { name: 'SRD', url: '/' },
          { name: 'Chassis', url: '/schema/chassis/' },
          { name: chassisName, url: `/schema/chassis/item/${gopher?.id ?? 'gopher'}/` },
        ]}
      />
    </div>
    <div>
      <Caption>SRD · full · home: no second nav row</Caption>
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="https://intheunionnow.com"
        search={srdSearch}
        buyHref={BUY}
      />
    </div>
    <div>
      <Caption>full · with a product row (44px, paper)</Caption>
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="https://intheunionnow.com"
        search={srdSearch}
        buyHref={BUY}
        navItems={[
          { label: 'Chassis', href: '/schema/chassis/', active: true },
          { label: 'Systems', href: '/schema/systems/' },
          { label: 'Modules', href: '/schema/modules/' },
        ]}
        secondaryItems={[
          { label: 'Changelog', href: '/changelog/' },
          { label: 'API', href: '/api/' },
          { label: 'About', href: '/about/' },
        ]}
      />
    </div>
    <div>
      <Caption>ITUN · compact · one 48px row</Caption>
      <AppBar
        product="build"
        referenceHref="https://salvageunion.io"
        buildHref="/"
        density="compact"
        navItems={[
          { label: 'Shelves', href: '/', active: true },
          { label: 'Starter Set', href: '/starter/' },
        ]}
        secondaryItems={[
          { label: 'About', href: '/about' },
          { label: 'Changelog', href: '/changelog' },
        ]}
      />
    </div>
  </div>
)
