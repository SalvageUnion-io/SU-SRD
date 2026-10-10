import { ChevronDown, Search } from 'lucide-react'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Avatar } from '../chrome/Avatar'
import { AppBar } from './AppBar'
import { NavDrawer } from './NavDrawer'
import { SearchField } from './SearchField'

export default {
  title: 'Compositions/Shell/App Bar',
}

// Real SRD content — reference data is preloaded by catalog.tsx.
const gopher = SalvageUnionReference.Chassis.getByName('Gopher')
const chassisName = gopher?.name ?? 'Gopher'

const STACK = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties

const BUY = 'https://leyline.press/collections/salvage-union'

// ITUN's signed-in slots are app code (`GamesMenu`, `AccountMenu` and
// `GlobalSearch` in apps/itun, wired to Convex), so the row below draws their
// closed triggers with the same type and geometry: a menu trigger on the bar's
// nav-link ramp, the "Search · ⌘K" field button, and the avatar.
const MENU_TRIGGER = {
  alignItems: 'center',
  alignSelf: 'center',
  background: 'none',
  border: 'none',
  color: color.paper70,
  cursor: 'pointer',
  display: 'inline-flex',
  flexShrink: 0,
  fontFamily: font.cond,
  fontSize: fontSize.lede,
  fontWeight: weight.bold,
  gap: space[6],
  letterSpacing: tracking.capsTight,
  padding: `${space[4]} 0`,
  textTransform: 'uppercase',
} satisfies CSSProperties

const ACCOUNT_NAME = { color: color.paper, textTransform: 'none' } satisfies CSSProperties

const ITUN_SEARCH = {
  alignItems: 'center',
  background: 'transparent',
  borderColor: color.paper60,
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  color: color.paper,
  cursor: 'pointer',
  display: 'inline-flex',
  flexShrink: 0,
  fontFamily: font.cond,
  fontSize: fontSize.caption,
  fontWeight: weight.bold,
  gap: space[8],
  height: 36,
  letterSpacing: tracking.capsSnug,
  paddingInline: space[12],
  textTransform: 'uppercase',
} satisfies CSSProperties

const KEY_HINT = {
  color: color.paper60,
  fontFamily: font.body,
  fontWeight: weight.medium,
  letterSpacing: 0,
} satisfies CSSProperties

// The phone's search icon: a 44px square, the touch floor (ruleset §4.6).
const ICON_BUTTON = {
  alignItems: 'center',
  background: 'none',
  border: 'none',
  color: color.paper,
  cursor: 'pointer',
  display: 'inline-flex',
  height: 44,
  justifyContent: 'center',
  width: 44,
} satisfies CSSProperties

const PLAYER = 'Rook'

const itunDrawerNav = [
  { label: 'Shelves', href: '/', active: true },
  { label: 'Starter Set', href: '/starter/' },
  { label: 'About', href: '/about' },
  { label: 'Changelog', href: '/changelog' },
]

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
      <Caption>ITUN · compact · signed out: one 48px row</Caption>
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
    <div>
      <Caption>
        ITUN · compact · signed in: Shelves · Games · Starter Set, search and the account
      </Caption>
      <AppBar
        product="build"
        referenceHref="https://salvageunion.io"
        buildHref="/"
        density="compact"
        navItems={[
          { label: 'Shelves', href: '/', active: true },
          {
            id: 'games',
            node: (
              <button type="button" aria-haspopup="menu" style={MENU_TRIGGER}>
                Games <ChevronDown size={14} aria-hidden="true" />
              </button>
            ),
          },
          { label: 'Starter Set', href: '/starter/' },
        ]}
        secondaryItems={[
          { label: 'About', href: '/about' },
          { label: 'Changelog', href: '/changelog' },
        ]}
        search={
          <button
            type="button"
            aria-label="Search"
            aria-keyshortcuts="Meta+K Control+K"
            className="su-union-bar__search"
            style={ITUN_SEARCH}
          >
            <Search size={16} aria-hidden="true" />
            <span aria-hidden="true">Search</span>
            <span aria-hidden="true" style={KEY_HINT}>
              ⌘K
            </span>
          </button>
        }
        actions={
          <button
            type="button"
            aria-haspopup="menu"
            aria-label={`Account menu for ${PLAYER}`}
            style={MENU_TRIGGER}
          >
            <Avatar src={null} name={PLAYER} size={28} />
            <span style={ACCOUNT_NAME}>{PLAYER}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        }
        mobile={
          <>
            <button type="button" aria-label="Search" style={ICON_BUTTON}>
              <Search size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-haspopup="menu"
              aria-label={`Account menu for ${PLAYER}`}
              style={MENU_TRIGGER}
            >
              <Avatar src={null} name={PLAYER} size={32} />
            </button>
            <NavDrawer brand={<span>In the Union Now</span>} navItems={itunDrawerNav} />
          </>
        }
      />
    </div>
  </div>
)
