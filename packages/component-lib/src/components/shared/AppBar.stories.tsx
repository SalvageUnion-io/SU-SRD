import { ChevronDown, Search } from 'lucide-react'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Avatar } from '../chrome/Avatar'
import { AppBar } from './AppBar'
import { NavDrawer } from './NavDrawer'
import { SearchField, SearchFieldTrigger } from './SearchField'

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
// nav-link ramp, the search field's trigger, and the avatar.
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
  <SearchField
    placeholder="Search the SRD"
    aria-label="Search the SRD"
    shortcut="⌘K"
    className="su-union-bar__search-input"
  />
)

/**
 * The Union bar (board 05) — one lockup, the Reference | Build switcher, the
 * search slot and the product's own nav. Both tools wear the same 56px bar and
 * the same search entry (refit S2); the SRD's carries its breadcrumb trail
 * (board 07), ITUN's its nav inline (boards 09 and 10). The "here" tab is the inverse stamp,
 * never rust. Narrow the window below 1024px to see the phone shape: the trail
 * moves to its own paper row under the bar.
 */
export const Default: Story = () => (
  <div style={STACK}>
    <div>
      <Caption>SRD · an entity page, breadcrumbs in the bar</Caption>
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="https://salvageunion.io/build/"
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
      <Caption>SRD · home</Caption>
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="https://salvageunion.io/build/"
        search={srdSearch}
        buyHref={BUY}
      />
    </div>
    <div>
      <Caption>ITUN · signed out</Caption>
      <AppBar
        product="build"
        referenceHref="https://salvageunion.io"
        buildHref="/"
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
      <Caption>ITUN · signed in: Shelves · Games · Starter Set, search and the account</Caption>
      <AppBar
        product="build"
        referenceHref="https://salvageunion.io"
        buildHref="/"
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
          <SearchFieldTrigger
            label="Search the SRD"
            shortcut="⌘K"
            labelClassName="su-union-bar__search-input"
          />
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
