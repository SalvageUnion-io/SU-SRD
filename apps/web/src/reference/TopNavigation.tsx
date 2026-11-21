/**
 * TopNavigation — the site header.
 *
 * The one Union bar (`unionBar/UnionBar`, ruleset §3.11) on its **Reference**
 * side; the interactive search, account and phone drawer (`UnionDrawer`, as
 * `MobileNavIsland`) are slotted in as independently-mounted islands so the
 * bar ships no client JS of its own.
 *
 * The chrome islands are server-rendered and `client="interaction"`: the
 * field and the two phone buttons are in the HTML, and React loads only when a
 * reader reaches for one (`runtime/interaction.ts`), so a page read and left
 * runs none. They take **no props**: `MobileNavIsland` computing its own
 * catalog is what removes 17.3 MB of duplicated props from the build.
 *
 * The account controls are the app's, through the account hint
 * (`lib/accountBar.ts`): Sign in is served on every page, and the account menu
 * islands (`when="signed-in"`; on a phone the avatar alone) mount in its place
 * only while somebody is signed in.
 */

import { Button } from '../components/index'
import { MobileNavIsland } from '../components/islands/MobileNavIsland'
import { MobileSearchIsland } from '../components/islands/MobileSearchIsland'
import { SearchIsland } from '../components/islands/SearchIsland'
import { AREA_NAV } from '../components/unionBar/areaNav.model'
import { UnionBar } from '../components/unionBar/UnionBar'
import { SIGN_IN_HREF } from '../lib/accountBar'
import { sectionHrefFor } from '../lib/chapters'
import { referenceCopy } from '../messages/reference'
import { Island } from '../runtime/Island'

/**
 * Sign in, served on every page and hidden while somebody is signed in
 * (`lib/accountBar.ts`), when the account menu's island takes its place.
 * Dressed as "Buy the game" beside it, as the app's is.
 */
function SignInLink() {
  return (
    <Button
      href={SIGN_IN_HREF}
      linkAs="a"
      variant="ghost"
      size="compact"
      className="su-union-bar__action su-sign-in"
    >
      {referenceCopy('signInWithDiscord')}
    </Button>
  )
}

/** The sub-navigation's entries, by href. */
const REFERENCE_SECTIONS = AREA_NAV.reference.links.map((link) => link.href)

type BreadcrumbItem = {
  name: string
  url: string
}

type TopNavigationProps = {
  breadcrumbs?: BreadcrumbItem[]
  /**
   * The page carries its own search (the 404's band),
   * so the bar's desktop field would be a second copy. The phone's search
   * trigger stays: below `lg` the band's field sits under the fold of the bar.
   */
  pageHasSearch?: boolean
  /** The site's front door: no area link is current. */
  home?: boolean
  /** The page's address: its section is marked in the sub-navigation. */
  pathname?: string
}

export function TopNavigation({
  breadcrumbs,
  pageHasSearch = false,
  home = false,
  pathname,
}: TopNavigationProps) {
  const section = pathname ? sectionHrefFor(pathname, REFERENCE_SECTIONS) : undefined
  return (
    <UnionBar
      product="reference"
      noCurrent={home}
      railCurrent={section ? { href: section, page: section === pathname } : undefined}
      breadcrumbs={breadcrumbs}
      // The 404 carries its own, and so does the home: its field stands under
      // its slideshow, always in view (r2 H6), where "/", Cmd/Ctrl+K and
      // "Look something up" focus it.
      search={
        pageHasSearch || home ? null : (
          <Island name="SearchIsland" client="interaction" ssr>
            <SearchIsland />
          </Island>
        )
      }
      actions={
        <>
          <SignInLink />
          <Island name="AccountIsland" client="idle" when="signed-in" />
        </>
      }
      mobile={
        <>
          {home ? null : (
            <Island name="MobileSearchIsland" client="interaction" ssr>
              <MobileSearchIsland />
            </Island>
          )}
          <Island name="AccountAvatarIsland" client="idle" when="signed-in" />
          <Island name="MobileNavIsland" client="interaction" ssr>
            <MobileNavIsland />
          </Island>
        </>
      }
    />
  )
}
