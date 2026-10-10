import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Fragment } from 'react'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { FOCUS_RING } from '../chrome/interaction'
import { Speckle } from '../chrome/Speckle'

/**
 * AppBar — the Union bar: the one masthead both SU tools wear (ruleset §3.11,
 * "One union, two tools"; origin board 05). The SRD `SiteHeader` and the ITUN
 * `AppHeader` are thin presets over it.
 *
 * One lockup (the SU mark and "SalvageUnion.io"), then the **Reference | Build**
 * product switcher, then the product's own nav, the search slot, "Buy the
 * game" and the app's account controls. Crossing products is a tab on the same
 * bar, never an off-site "Builder ↗" / "SRD ↗" link. The tab you are on is an
 * inverse stamp — a paper plate on the ink bar — and never rust (§3.1).
 *
 * ## Densities
 *
 * - `full` (the SRD) — a 64px bar with the wordmark. Its `navItems`, when it has
 *   any, sit one row down in a 44px paper product row; the SRD passes none, its
 *   index being the home page itself.
 * - `compact` (ITUN's app routes) — one 48px row: the mark without the
 *   wordmark, the switcher, and the product nav inline beside it. It gives a
 *   sheet or a Game its height back.
 *
 * ## Breadcrumbs
 *
 * On desktop the trail is in the bar, in paper, the current page in bold; there
 * is no separate breadcrumb row. A phone has no room in the bar, so below `lg`
 * the trail keeps a row of its own under it. Both render the same list, one of
 * them `display: none` at any width, so the accessibility tree holds one. The
 * BreadcrumbList JSON-LD is emitted once either way.
 *
 * ## Slots
 *
 * Presentational: nav links are data, and the search, actions and mobile
 * drawer are slots. Internal links route through the injected `LinkComponent`;
 * the other product is a plain same-tab anchor, and an `external` item opens a
 * new tab. So the shared library stays free of a router, search or account
 * dependency.
 *
 * Paper flecks lie behind the bar's content (`Speckle`, §3.5).
 */

export type AppBarProduct = 'reference' | 'build'

export type AppBarNavItem = {
  label: ReactNode
  href: string
  /** Marks the link as the page you are on (`aria-current="page"`). */
  active?: boolean
  /** Opens in a new tab via a plain anchor (bypasses LinkComponent). */
  external?: boolean
  /** Optional trailing pill (e.g. an "Alpha" tag). */
  badge?: ReactNode
}

/**
 * A nav entry the app renders itself — a control, not a link (ITUN's Games
 * menu). It takes its place in the nav's order and the bar knows nothing of it.
 */
export type AppBarNavSlot = {
  id: string
  node: ReactNode
}

export type AppBarNavEntry = AppBarNavItem | AppBarNavSlot

type BreadcrumbItem = {
  name: string
  url: string
}

type AppBarProps = {
  /** The tool this bar is mounted in: its switcher tab is the inverse stamp. */
  product: AppBarProduct
  /** Where "Reference" goes — the SRD's home. */
  referenceHref: string
  /** Where "Build" goes — ITUN's home. */
  buildHref: string
  /** `full` — 64px bar (+ 44px product row). `compact` — one 48px row. */
  density?: 'full' | 'compact'
  /** Link component for the brand + internal links. Defaults to a plain anchor. */
  LinkComponent?: ElementType
  viewTransitionName?: string
  /** The product's own nav (desktop). */
  navItems?: AppBarNavEntry[]
  /** Quiet links at the nav's far end (an About, a Changelog). */
  secondaryItems?: AppBarNavItem[]
  /** Desktop search slot — the site's combobox island or a trigger button. */
  search?: ReactNode
  /** "Buy the game" outbound link. Omit to hide. */
  buyHref?: string
  buyLabel?: ReactNode
  /**
   * Desktop controls at the right end of the bar — app-owned (ITUN's account
   * menu). A slot rather than nav data because these are controls, not links.
   * Desktop only: the `mobile` slot carries whatever the app wants below `lg`.
   */
  actions?: ReactNode
  /** Mobile cluster (search trigger + hamburger drawer), shown below `lg`. */
  mobile?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  /** A quiet tail after the trail (a listing's one-line description). */
  breadcrumbDescription?: string
}

const BAR = {
  backgroundColor: color.inkDeep,
  borderBottomColor: color.ink,
  borderBottomStyle: 'solid',
  borderBottomWidth: borderWidth.entity,
  color: color.paper,
  isolation: 'isolate',
  position: 'relative',
  zIndex: 50,
} satisfies CSSProperties

const BRAND = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: space[12],
  textDecoration: 'none',
} satisfies CSSProperties

const MARK = { display: 'block', flexShrink: 0 } satisfies CSSProperties

const WORDMARK = {
  color: color.paper,
  fontFamily: font.cond,
  fontSize: fontSize.title,
  fontWeight: weight.bold,
  lineHeight: 1,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const WORDMARK_ACCENT = { color: color.paper60 } satisfies CSSProperties

const SWITCH = {
  borderColor: color.paper30,
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  display: 'inline-flex',
  flexShrink: 0,
  overflow: 'hidden',
} satisfies CSSProperties

const LIST = {
  alignItems: 'center',
  display: 'flex',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const CRUMB_SEPARATOR = { userSelect: 'none' } satisfies CSSProperties

const CRUMB_DESCRIPTION = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

function isSlot(entry: AppBarNavEntry): entry is AppBarNavSlot {
  return 'node' in entry
}

type NavLinkProps = {
  item: AppBarNavItem
  className: string
  LinkComponent: ElementType
}

/** One nav link: external items open a new tab; internal ones route. */
function NavLink({ item, className, LinkComponent }: NavLinkProps) {
  const Link = item.external ? 'a' : LinkComponent
  return (
    <Link
      href={item.href}
      className={`${className} ${FOCUS_RING}`}
      {...(item.external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : { 'aria-current': item.active ? ('page' as const) : undefined })}
    >
      {item.label}
      {item.badge}
    </Link>
  )
}

function Trail({
  breadcrumbs,
  description,
}: {
  breadcrumbs: BreadcrumbItem[]
  description?: string
}) {
  return (
    <>
      <ol className="su-crumbs__list" style={LIST}>
        {breadcrumbs.map((item, index) => (
          <Fragment key={item.url}>
            {index > 0 && (
              <li aria-hidden="true" className="su-crumbs__separator" style={CRUMB_SEPARATOR}>
                /
              </li>
            )}
            <li className="su-crumbs__item">
              {index === breadcrumbs.length - 1 ? (
                <span aria-current="page" className="su-crumbs__here">
                  {item.name}
                </span>
              ) : (
                <a href={item.url} className={`su-crumbs__link ${FOCUS_RING}`}>
                  {item.name}
                </a>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
      {description && (
        <span className="su-crumbs__description" style={CRUMB_DESCRIPTION} title={description}>
          — {description}
        </span>
      )}
    </>
  )
}

export function AppBar({
  product,
  referenceHref,
  buildHref,
  density = 'full',
  LinkComponent = 'a',
  viewTransitionName,
  navItems = [],
  secondaryItems = [],
  search,
  buyHref,
  buyLabel = 'Buy the game',
  actions,
  mobile,
  breadcrumbs,
  breadcrumbDescription,
}: AppBarProps) {
  const compact = density === 'compact'
  const hasCrumbs = breadcrumbs !== undefined && breadcrumbs.length > 0

  // The switcher: this product's tab routes home; the other is a same-tab
  // anchor to the other tool — a tab on one bar, not an off-site link.
  const tabs: { key: AppBarProduct; label: string; href: string }[] = [
    { key: 'reference', label: 'Reference', href: referenceHref },
    { key: 'build', label: 'Build', href: buildHref },
  ]

  const navLinks = (linkClass: string) =>
    navItems.map((entry) =>
      isSlot(entry) ? (
        <Fragment key={entry.id}>{entry.node}</Fragment>
      ) : (
        <NavLink
          key={entry.href}
          item={entry}
          className={linkClass}
          LinkComponent={LinkComponent}
        />
      )
    )

  const quietLinks = secondaryItems.map((item) => (
    <NavLink
      key={item.href}
      item={item}
      className="su-union-bar__quiet"
      LinkComponent={LinkComponent}
    />
  ))

  return (
    <>
      <header
        className="su-union-bar"
        data-density={density}
        style={viewTransitionName ? { ...BAR, viewTransitionName } : BAR}
      >
        <Speckle grain="paper" />
        <div className="su-union-bar__row">
          {/* The lockup. The mark's alt names the link; the wordmark is the
              same name drawn, so it is hidden from the accessibility tree. */}
          <LinkComponent href="/" className={`su-union-bar__brand ${FOCUS_RING}`} style={BRAND}>
            <img
              src="/logos/su-cargo-dark.svg"
              alt="Salvage Union"
              width={compact ? 32 : 40}
              height={compact ? 32 : 40}
              style={MARK}
            />
            {!compact && (
              <span aria-hidden="true" className="su-union-bar__wordmark" style={WORDMARK}>
                SalvageUnion<span style={WORDMARK_ACCENT}>.io</span>
              </span>
            )}
          </LinkComponent>

          <nav aria-label="Salvage Union tools" style={SWITCH}>
            {tabs.map((tab) => {
              const here = tab.key === product
              const Link = here ? LinkComponent : 'a'
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`su-union-bar__tab ${FOCUS_RING}`}
                  aria-current={here ? 'true' : undefined}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>

          {compact && navItems.length > 0 && (
            <nav aria-label="Main navigation" className="su-union-bar__nav">
              {navLinks('su-union-bar__link')}
            </nav>
          )}

          {hasCrumbs && (
            <nav aria-label="Breadcrumb" className="su-crumbs su-crumbs--bar">
              <Trail breadcrumbs={breadcrumbs} description={breadcrumbDescription} />
            </nav>
          )}

          {/* Desktop: the right-hand cluster, pushed to the end. */}
          <div className="su-union-bar__end">
            {compact && quietLinks}
            {search}
            {buyHref && (
              <a
                href={buyHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`su-union-bar__buy ${FOCUS_RING}`}
              >
                {buyLabel} <span aria-hidden="true">↗</span>
              </a>
            )}
            {actions}
          </div>

          {/* Mobile: search trigger + hamburger, below `lg`. */}
          {mobile && <div className="su-union-bar__mobile">{mobile}</div>}
        </div>

        {!compact && (navItems.length > 0 || secondaryItems.length > 0) && (
          <nav aria-label="Main navigation" className="su-union-bar__product-row">
            {navLinks('su-union-bar__product-link')}
            <span className="su-union-bar__product-end">{quietLinks}</span>
          </nav>
        )}
      </header>

      {hasCrumbs && (
        <>
          <nav aria-label="Breadcrumb" className="su-crumbs su-crumbs--row">
            <Trail breadcrumbs={breadcrumbs} description={breadcrumbDescription} />
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
