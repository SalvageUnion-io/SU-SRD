import { Fragment } from 'react'
import type { ElementType, ReactNode } from 'react'
import { cn } from '../../utils/cn'

/**
 * AppBar — the shared masthead both SU surfaces are built from (the internal
 * implementation behind the SRD `SiteHeader` and the ITUN `AppHeader` presets).
 * Renders the SU brand lockup + a config-driven right-side cluster: desktop nav
 * links + a search slot + an optional "Buy the game" button, a mobile slot that
 * collapses the nav into a drawer below `lg`, and an optional breadcrumb bar
 * with JSON-LD.
 *
 * Presentational: nav links are data (`navItems`), the search + mobile drawer
 * are slots, and internal links route through the injected `LinkComponent`
 * (external ones open in a new tab), so the shared library stays free of a
 * router/search dependency.
 */

export type AppBarNavItem = {
  label: ReactNode
  href: string
  /** Marks the link active (aria-current + highlighted). */
  active?: boolean
  /** Opens in a new tab via a plain anchor (bypasses LinkComponent). */
  external?: boolean
  /** Optional trailing pill (e.g. an "Alpha" tag). */
  badge?: ReactNode
}

type BreadcrumbItem = {
  name: string
  url: string
}

type AppBarProps = {
  // Brand
  wordmark: string
  wordmarkAccent?: string
  badge?: string
  eyebrow: string
  homeHref?: string
  brandShrink?: boolean
  /** Link component for the brand + internal nav links. Defaults to a plain anchor. */
  LinkComponent?: ElementType
  viewTransitionName?: string
  // Desktop nav
  navItems: AppBarNavItem[]
  /** Desktop search slot — the site's combobox island or a modal trigger button. */
  search?: ReactNode
  /** "Buy the game" outbound link. Omit to hide. */
  buyHref?: string
  buyLabel?: ReactNode
  /** Mobile cluster (search trigger + hamburger drawer), shown below `lg`. */
  mobile?: ReactNode
  // Breadcrumbs (optional — the SRD schema/item routes)
  breadcrumbs?: BreadcrumbItem[]
  breadcrumbDescription?: string
}

const NAV_LINK =
  'inline-flex shrink-0 items-center font-cond text-[15px] font-semibold uppercase tracking-[0.04em] text-su-muted no-underline transition-colors hover:text-su-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange'

const NAV_LINK_ACTIVE = 'text-su-paper'

const BUY_BUTTON =
  'inline-flex shrink-0 items-center rounded-md border border-su-orange-dark bg-su-orange-dark px-4 py-1.5 font-cond text-[13px] font-medium uppercase tracking-[0.06em] text-paper no-underline transition-colors'

const BREADCRUMB_TEXT = 'font-cond text-xs uppercase tracking-[0.14em] text-ink-2'

export function AppBar({
  wordmark,
  wordmarkAccent,
  badge,
  eyebrow,
  homeHref = '/',
  brandShrink = false,
  LinkComponent = 'a',
  viewTransitionName,
  navItems,
  search,
  buyHref,
  buyLabel = 'BUY THE GAME',
  mobile,
  breadcrumbs,
  breadcrumbDescription,
}: AppBarProps) {
  return (
    <>
      <header
        className="z-50 flex items-center gap-[14px] border-b-entity border-su-orange-dark bg-su-ink-dark px-5 py-3 sm:px-[34px] sm:py-[14px]"
        style={viewTransitionName ? { viewTransitionName } : undefined}
      >
        {/* Brand lockup: SU cargo mark + wordmark (+ optional accent/badge) +
            tracked eyebrow. `brandShrink` lets a long wordmark/eyebrow wrap
            instead of forcing horizontal overflow. */}
        <LinkComponent
          href={homeHref}
          className={cn(
            'flex items-center gap-[14px] no-underline',
            brandShrink ? 'min-w-0' : 'shrink-0'
          )}
        >
          <img
            src="/logos/su-cargo-dark.svg"
            alt="Salvage Union"
            width={64}
            height={64}
            className="block size-12 shrink-0 rounded-xl sm:size-16"
          />
          <span className="flex min-w-0 flex-col">
            <span className="font-cond text-[26px] font-bold leading-[0.98] tracking-[0.005em] text-su-paper sm:text-[34px]">
              {wordmark}
              {wordmarkAccent && <span className="text-su-orange-dark">{wordmarkAccent}</span>}
              {badge && (
                <span className="ml-2 inline-block rounded bg-rust px-1.5 py-0.5 align-[0.32em] font-cond text-caption font-bold uppercase leading-none tracking-caps text-su-paper">
                  {badge}
                </span>
              )}
            </span>
            <span
              className={cn(
                'mt-[7px] font-cond text-caption font-semibold uppercase tracking-eyebrow text-su-orange sm:mt-[9px]',
                brandShrink ? 'leading-tight' : 'whitespace-nowrap leading-none'
              )}
            >
              {eyebrow}
            </span>
          </span>
        </LinkComponent>

        {/* Desktop nav cluster — links + search + buy, pushed right. */}
        <nav
          aria-label="Main navigation"
          className="ml-auto hidden items-center gap-[26px] lg:flex"
        >
          {navItems.map((item) => {
            const className = cn(NAV_LINK, item.active && NAV_LINK_ACTIVE)
            const content = (
              <>
                {item.label}
                {item.badge}
              </>
            )
            return item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {content}
              </a>
            ) : (
              <LinkComponent
                key={item.href}
                href={item.href}
                className={className}
                aria-current={item.active ? 'page' : undefined}
              >
                {content}
              </LinkComponent>
            )
          })}

          {search}

          {buyHref && (
            <a href={buyHref} target="_blank" rel="noopener noreferrer" className={BUY_BUTTON}>
              {buyLabel}
            </a>
          )}
        </nav>

        {/* Mobile: search trigger + hamburger, below `lg`. */}
        {mobile && <div className="ml-auto flex items-center gap-1 lg:hidden">{mobile}</div>}
      </header>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <>
          <nav
            aria-label="Breadcrumb"
            className="sticky top-0 z-40 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-wk-faint bg-paper px-5 py-2 shadow-sm sm:px-[34px]"
          >
            <ol className={cn(BREADCRUMB_TEXT, 'flex flex-wrap items-center gap-1.5')}>
              {breadcrumbs.map((item, index) => (
                <Fragment key={item.url}>
                  {index > 0 && (
                    <li aria-hidden="true" className="select-none text-ink-2">
                      /
                    </li>
                  )}
                  <li>
                    {index === breadcrumbs.length - 1 ? (
                      <span aria-current="page" className="font-semibold text-ink">
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
