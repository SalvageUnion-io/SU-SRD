/**
 * TopNavigation — the site header.
 *
 * Static brand chrome via the shared React `SiteHeader`; the interactive search
 * + mobile nav are slotted in as independently-mounted islands so the shared
 * component ships no client JS of its own.
 *
 * All three chrome islands are `client="idle"`, `ssr={false}` and take **no
 * props** — they are chrome with no SEO value, and `MobileNavIsland` computing
 * its own catalog is what removes 17.3 MB of duplicated props from the build.
 */

import { ITUN_URL } from '../lib/constants'
import { Island } from '../runtime/Island'
import { SiteHeader } from './SiteHeader'

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
    <SiteHeader
      itunUrl={ITUN_URL}
      breadcrumbs={breadcrumbs}
      breadcrumbDescription={breadcrumbDescription}
      // Cross-document view transitions (`@view-transition { navigation: auto }`)
      // match on this name.
      viewTransitionName="nav"
      search={pageHasSearch ? undefined : <Island name="SearchIsland" client="idle" />}
      mobile={
        <>
          <Island name="MobileSearchIsland" client="idle" />
          <Island name="MobileNavIsland" client="idle" />
        </>
      }
    />
  )
}
