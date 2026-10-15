import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Fragment } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from '../atoms/interaction'
import { Speckle } from '../atoms/Speckle'

/**
 * AppBar — the Union bar: the one masthead both SU tools wear (ruleset §3.11,
 * "One union, two tools"; origin board 05). The SRD `TopNavigation` and the Cantina's
 * shell (`shell/unionBar.ts`) are thin presets over it.
 *
 * One lockup (the SU mark alone, no wordmark), then the **Reference | Build**
 * product switcher, then the product's own nav, the search slot, "Buy the
 * game" and the app's account controls. Crossing products is a tab on the same
 * bar, never an off-site "Builder ↗" / "SRD ↗" link. The tab you are on is an
 * inverse stamp — a paper plate on the ink bar — and never rust (§3.1).
 *
 * ## One geometry
 *
 * Both tools wear the same bar (one product at one domain): one
 * 56px row at every width, one height for the mark and every control in it
 * (`--su-union-bar-control`, `styles/partials/shell.css`), the product
 * nav inline beside the switcher from `lg`, and the search entry at the same
 * place in the same shape (`SearchField` / `SearchFieldTrigger`). There are no
 * densities: the SRD's 64px bar and the Cantina's 48px one were two products.
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

type AppBarProduct = 'reference' | 'build'

type AppBarNavItem = {
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
 * A nav entry the app renders itself — a control, not a link (The Cantina's Games
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
  /** Where "Build" goes — the Cantina's home. */
  buildHref: string
  /** Link component for the brand + internal links. Defaults to a plain anchor. */
  LinkComponent?: ElementType
  /**
   * The SU mark's URL. The app's own copy: The Cantina serves its files under
   * `/build/` (ADR-048), so the root's is srd's on one origin and missing on
   * any other.
   */
  markSrc?: string
  viewTransitionName?: string
  /** The product's own nav (desktop), inline beside the switcher. */
  navItems?: AppBarNavEntry[]
  /**
   * Desktop search slot — the SRD's `SearchField` combobox or the Cantina's
   * `SearchFieldTrigger`: one shape, `su-union-bar__search-input` wide.
   */
  search?: ReactNode
  /** "Buy the game" outbound link. Omit to hide. */
  buyHref?: string
  /**
   * Desktop controls at the right end of the bar — app-owned (The Cantina's account
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

// The frame is an inset outline, not a border, so the switcher is exactly its
// tabs' height: the bar's one control height, with nothing added around it.
const SWITCH = {
  borderRadius: radius.card,
  display: 'inline-flex',
  flexShrink: 0,
  outlineColor: color.paper30,
  outlineOffset: `calc(-1 * ${borderWidth.chrome})`,
  outlineStyle: 'solid',
  outlineWidth: borderWidth.chrome,
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
      className={cn(className, FOCUS_RING)}
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
                <a href={item.url} className={cn('su-crumbs__link', FOCUS_RING)}>
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
  LinkComponent = 'a',
  markSrc = '/logos/su-cargo-dark.svg',
  viewTransitionName,
  navItems = [],
  search,
  buyHref,
  actions,
  mobile,
  breadcrumbs,
  breadcrumbDescription,
}: AppBarProps) {
  const hasCrumbs = breadcrumbs !== undefined && breadcrumbs.length > 0

  // The switcher: this product's tab routes home; the other is a same-tab
  // anchor to the other tool — a tab on one bar, not an off-site link.
  const tabs: { key: AppBarProduct; label: string; href: string }[] = [
    { key: 'reference', label: 'Reference', href: referenceHref },
    { key: 'build', label: 'Build', href: buildHref },
  ]

  const navLinks = () =>
    navItems.map((entry) =>
      isSlot(entry) ? (
        <Fragment key={entry.id}>{entry.node}</Fragment>
      ) : (
        <NavLink
          key={entry.href}
          item={entry}
          className="su-union-bar__link"
          LinkComponent={LinkComponent}
        />
      )
    )

  return (
    <>
      <header
        className="su-union-bar"
        style={viewTransitionName ? { ...BAR, viewTransitionName } : BAR}
      >
        <Speckle grain="paper" />
        <div className="su-union-bar__row">
          {/* The lockup is the mark alone; its alt names the link. */}
          <LinkComponent href="/" className={cn('su-union-bar__brand', FOCUS_RING)} style={BRAND}>
            <img
              src={markSrc}
              alt="Salvage Union"
              width={40}
              height={40}
              className="su-union-bar__mark"
              style={MARK}
            />
          </LinkComponent>

          <nav aria-label="Salvage Union tools" style={SWITCH}>
            {tabs.map((tab) => {
              const here = tab.key === product
              const Link = here ? LinkComponent : 'a'
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={cn('su-union-bar__tab', FOCUS_RING)}
                  aria-current={here ? 'true' : undefined}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>

          {navItems.length > 0 && (
            <nav aria-label="Main navigation" className="su-union-bar__nav">
              {navLinks()}
            </nav>
          )}

          {hasCrumbs && (
            <nav aria-label="Breadcrumb" className="su-crumbs su-crumbs--bar">
              <Trail breadcrumbs={breadcrumbs} description={breadcrumbDescription} />
            </nav>
          )}

          {/* Desktop: the right-hand cluster, pushed to the end. */}
          <div className="su-union-bar__end">
            {search}
            {buyHref && (
              <a
                href={buyHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('su-union-bar__buy', FOCUS_RING)}
              >
                Buy the game <span aria-hidden="true">↗</span>
              </a>
            )}
            {actions}
          </div>

          {/* Mobile: search trigger + hamburger, below `lg`. */}
          {mobile && <div className="su-union-bar__mobile">{mobile}</div>}
        </div>
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
