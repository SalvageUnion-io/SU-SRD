/**
 * TopNavigation — the site header.
 *
 * Static brand chrome via the shared Union bar (`AppBar`, ruleset §3.11) on its
 * **Reference** side; the interactive search
 * + mobile nav are slotted in as independently-mounted islands so the shared
 * component ships no client JS of its own.
 *
 * The chrome islands are server-rendered and `client="interaction"`: the
 * field and the two phone buttons are in the HTML, and React loads only when a
 * reader reaches for one (`runtime/interaction.ts`), so a page read and left
 * runs none. They take **no props**: `MobileNavIsland` computing its own
 * catalog is what removes 17.3 MB of duplicated props from the build.
 * `WikiLink` is served twice (desktop cluster and phone cluster), hidden; the
 * client entry reveals both on one page load in a hundred.
 */

import { AppBar, FOCUS_RING } from 'component-lib'
import { ITUN_URL } from '../lib/constants'
import { WIKI_LINK_ATTRIBUTE } from '../lib/wikiLink'
import { Island } from '../runtime/Island'
import { MobileNavIsland } from './islands/MobileNavIsland'
import { MobileSearchIsland } from './islands/MobileSearchIsland'
import { SearchIsland } from './islands/SearchIsland'

/**
 * The quiet "WIKI" link to the `/greembeem` easter egg, served hidden: the
 * client entry rolls once per page load and shows every copy on one in a
 * hundred (`lib/wikiLink.ts`).
 */
function WikiLink() {
  return (
    <a
      href="/greembeem"
      className={`su-union-bar__quiet ${FOCUS_RING}`}
      hidden
      {...{ [WIKI_LINK_ATTRIBUTE]: '' }}
    >
      WIKI
    </a>
  )
}

type BreadcrumbItem = {
  name: string
  url: string
}

type TopNavigationProps = {
  breadcrumbs?: BreadcrumbItem[]
  /** Optional descriptive tail rendered after the trail (e.g. a schema description) */
  breadcrumbDescription?: string
  /**
   * The page carries its own search (the home page's Contents band, board 06),
   * so the bar's desktop field would be a second copy. The phone's search
   * trigger stays: below `lg` the band's field sits under the fold of the bar.
   */
  pageHasSearch?: boolean
}

export function TopNavigation({
  breadcrumbs,
  breadcrumbDescription,
  pageHasSearch = false,
}: TopNavigationProps) {
  return (
    <AppBar
      product="reference"
      referenceHref="/"
      buildHref={ITUN_URL}
      buyHref="https://leyline.press/collections/salvage-union"
      breadcrumbs={breadcrumbs}
      breadcrumbDescription={breadcrumbDescription}
      // Cross-document view transitions (`@view-transition { navigation: auto }`)
      // match on this name.
      viewTransitionName="nav"
      // The WIKI link sits left of the search, so it rides the search slot; it
      // stays when the page carries its own search.
      search={
        <>
          <WikiLink />
          {pageHasSearch ? null : (
            <Island name="SearchIsland" client="interaction" ssr>
              <SearchIsland />
            </Island>
          )}
        </>
      }
      mobile={
        <>
          <WikiLink />
          <Island name="MobileSearchIsland" client="interaction" ssr>
            <MobileSearchIsland />
          </Island>
          <Island name="MobileNavIsland" client="interaction" ssr>
            <MobileNavIsland />
          </Island>
        </>
      }
    />
  )
}
