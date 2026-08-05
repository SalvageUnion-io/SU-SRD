/**
 * TopNavigation — the SSG port of `TopNavigation.astro`.
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
  currentPath: string
  breadcrumbs?: BreadcrumbItem[]
  /** Optional descriptive tail rendered after the trail (e.g. a schema description) */
  breadcrumbDescription?: string
}

export function TopNavigation({
  currentPath,
  breadcrumbs,
  breadcrumbDescription,
}: TopNavigationProps) {
  return (
    <SiteHeader
      currentPath={currentPath}
      itunUrl={ITUN_URL}
      breadcrumbs={breadcrumbs}
      breadcrumbDescription={breadcrumbDescription}
      // Kept from the Astro version: cross-document view transitions
      // (`@view-transition { navigation: auto }`) match on this name too.
      viewTransitionName="nav"
      search={<Island name="SearchIsland" client="idle" />}
      mobile={
        <>
          <Island name="MobileSearchIsland" client="idle" />
          <Island name="MobileNavIsland" client="idle" />
        </>
      }
    />
  )
}
