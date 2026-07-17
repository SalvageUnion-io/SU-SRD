import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { HeaderShell } from './HeaderShell'
import { cn } from '../../utils/cn'

/**
 * SiteHeader — the SRD reference site's brand chrome (converted from suref-web's
 * TopNavigation.astro, pending review). Fills the shared `HeaderShell` with the
 * SRD's static right-side nav (SRD / About / Changelog / Discord / API +
 * outbound Builder cross-link + Buy the game) and an optional breadcrumb bar
 * with JSON-LD.
 *
 * Presentational + static only — it ships no client JS of its own. The
 * interactive pieces (desktop search, mobile search + nav drawer) are passed in
 * as the `search` / `mobile` slots so the consuming Astro page can hydrate them
 * independently, keeping this shared component free of a router/search
 * dependency. The former `.nav-link` / `.btn` / `.breadcrumb-text` global rules
 * are replicated as utilities so it renders identically in Ladle and the site.
 */

type BreadcrumbItem = {
  name: string
  url: string
}

type SiteHeaderProps = {
  /** Current pathname, drives the active nav state (e.g. Astro.url.pathname). */
  currentPath: string
  /** Destination for the outbound ITUN builder cross-link. */
  itunUrl: string
  breadcrumbs?: BreadcrumbItem[]
  /** Descriptive tail rendered after the breadcrumb trail (e.g. a schema description). */
  breadcrumbDescription?: string
  /** Stable `view-transition-name` forwarded to HeaderShell (Astro ClientRouter). */
  viewTransitionName?: string
  /** Desktop search trigger (suref-web slots its SearchIsland here). */
  search?: ReactNode
  /** Mobile cluster — search trigger + hamburger drawer (slotted, hydrated by the site). */
  mobile?: ReactNode
}

const NAV_LINK =
  'inline-flex shrink-0 items-center font-cond text-[15px] font-semibold uppercase tracking-[0.04em] text-su-muted no-underline transition-colors hover:text-su-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange'

const NAV_LINK_ACTIVE = 'text-su-paper'

const BUY_BUTTON =
  'inline-flex shrink-0 items-center rounded-md border border-su-orange-dark bg-su-orange-dark px-4 py-1.5 font-cond text-[13px] font-medium uppercase tracking-[0.06em] text-paper no-underline transition-colors'

const BREADCRUMB_TEXT = 'font-cond text-xs uppercase tracking-[0.14em] text-su-grey-dark'

export function SiteHeader({
  currentPath,
  itunUrl,
  breadcrumbs,
  breadcrumbDescription,
  viewTransitionName,
  search,
  mobile,
}: SiteHeaderProps) {
  const isActive = (path: string) => currentPath.startsWith(path)
  const srdActive = isActive('/schema') || currentPath === '/'

  return (
    <>
      {/* Cargo brand header via the shared HeaderShell (also used by the ITUN
          builder): SU mark + SalvageUnion.io wordmark on the left, SRD-specific
          nav pushed right. */}
      <HeaderShell
        homeHref="/"
        wordmark="SalvageUnion"
        wordmarkAccent=".io"
        eyebrow="The Salvage Union SRD"
        viewTransitionName={viewTransitionName}
      >
        {/* Existing nav links + BUILDER cross-link + search + buy — pushed right */}
        <nav
          aria-label="Main navigation"
          className="ml-auto hidden items-center gap-[26px] lg:flex"
        >
          <a
            href="/"
            className={cn(NAV_LINK, srdActive && NAV_LINK_ACTIVE)}
            aria-current={srdActive ? 'page' : undefined}
          >
            SRD
          </a>
          <a
            href="/about/"
            className={cn(NAV_LINK, isActive('/about') && NAV_LINK_ACTIVE)}
            aria-current={isActive('/about') ? 'page' : undefined}
          >
            ABOUT
          </a>
          <a
            href="/changelog/"
            className={cn(NAV_LINK, isActive('/changelog') && NAV_LINK_ACTIVE)}
            aria-current={isActive('/changelog') ? 'page' : undefined}
          >
            CHANGELOG
          </a>
          <a
            href="/discord/"
            className={cn(NAV_LINK, isActive('/discord') && NAV_LINK_ACTIVE)}
            aria-current={isActive('/discord') ? 'page' : undefined}
          >
            DISCORD
          </a>
          <a
            href="/api/"
            className={cn(NAV_LINK, isActive('/api') && NAV_LINK_ACTIVE)}
            aria-current={isActive('/api') ? 'page' : undefined}
          >
            API
          </a>

          {/* Cross-link out to the ITUN character builder (external) */}
          <a href={itunUrl} target="_blank" rel="noopener noreferrer" className={NAV_LINK}>
            BUILDER&nbsp;&#8599;
          </a>

          {search}
          <a
            href="https://leyline.press/collections/salvage-union"
            target="_blank"
            rel="noopener noreferrer"
            className={BUY_BUTTON}
          >
            BUY THE GAME
          </a>
        </nav>

        {/* Mobile: persistent search trigger + hamburger */}
        <div className="ml-auto flex items-center gap-1 lg:hidden">{mobile}</div>
      </HeaderShell>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <>
          <nav
            aria-label="Breadcrumb"
            className="sticky top-0 z-40 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-su-grey-light bg-paper px-5 py-2 shadow-sm sm:px-[34px]"
          >
            <ol className={cn(BREADCRUMB_TEXT, 'flex flex-wrap items-center gap-1.5')}>
              {breadcrumbs.map((item, index) => (
                <Fragment key={item.url}>
                  {index > 0 && (
                    <li aria-hidden="true" className="select-none text-su-grey-medium">
                      /
                    </li>
                  )}
                  <li>
                    {index === breadcrumbs.length - 1 ? (
                      <span aria-current="page" className="font-semibold text-su-black">
                        {item.name}
                      </span>
                    ) : (
                      <a href={item.url} className="transition-colors hover:text-su-orange-dark">
                        {item.name}
                      </a>
                    )}
                  </li>
                </Fragment>
              ))}
            </ol>
            {breadcrumbDescription && (
              <span className={BREADCRUMB_TEXT}>— {breadcrumbDescription}</span>
            )}
          </nav>

          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD breadcrumb structured data serialized from trusted build-time breadcrumb props, no user input
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: breadcrumbs.map((item, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: item.name,
                  item: item.url,
                })),
              }),
            }}
          />
        </>
      )}
    </>
  )
}
