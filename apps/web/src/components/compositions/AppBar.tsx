import type { CSSProperties, ElementType, ReactNode } from 'react'
import { Fragment } from 'react'
import { borderWidth, layer, radius, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { MARK_SRC } from '../../lib/documentHead'
import type { BreadcrumbItem } from '../atoms/BreadcrumbTrail'
import { BreadcrumbTrail } from '../atoms/BreadcrumbTrail'
import { capsLabel } from '../atoms/capsLabel'
import { FOCUS_RING } from '../atoms/interaction'
import { Speckle } from '../atoms/Speckle'

/** The switcher's tabs keep their rule's tracking, which steps with the bar's width. */
const TAB_CAPS = capsLabel({ tracking: 'inherit' })
const LINK = cn('su-union-bar__link', capsLabel())

/**
 * AppBar — the Union bar: the one masthead both SU tools wear (ruleset §3.11,
 * "One union, two tools"). Both render modes draw it through
 * one preset, `unionBar/UnionBar.tsx`.
 *
 * One lockup (the SU mark alone, no wordmark), then the **Reference | Build |
 * Play** mode switcher, then the product's own nav, the search slot, "Buy the
 * game" and the app's account controls. Crossing modes is a tab on the same
 * bar, never an off-site "Builder ↗" / "SRD ↗" link. The tab you are on is an
 * inverse stamp — a paper plate on the ink bar — and never rust (§3.1). Play
 * lives in the app beside Build, so the app's bar carries both modes' navs,
 * each `data-mode`, and shows the one its mode names: the shell's bar is
 * marked for the route it is served on (`markUnionRoute`), and the app moves
 * "here" as it routes (`UnionBarSlots`, by each tab's `data-tool` and each
 * link's `data-nav`).
 *
 * ## One geometry
 *
 * Both tools wear the same bar (one product at one domain): one
 * 56px row at every width, one height for the mark and every control in it
 * (`--su-union-bar-control`, `styles/partials/shell.css`), the product
 * nav inline beside the switcher from `lg`, and the search entry at the same
 * place in the same shape (the one `SearchField` combobox). There are no
 * densities: the SRD's 64px bar and the app's 48px one were two products.
 *
 * ## Breadcrumbs
 *
 * On desktop the trail is in the bar, in paper, the current page in bold; there
 * is no separate breadcrumb row. Where the bar has no room for it the trail
 * keeps a row of its own under it. A page whose chapter band carries the trail
 * on its title's plate (`ChapterBandTrail`) shows neither: both step aside. Both render the same list, one of
 * them `display: none` at any width, so the accessibility tree holds one. The
 * BreadcrumbList JSON-LD is the page head's (`BaseLayout`), with absolute URLs.
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
 *
 * ## Colour
 *
 * The bar wears its mode (`data-mode`). In the reference it is ink, paper on
 * it, until a page leads with a chapter band: then it wears that band's
 * colour, foreground and grain, so the site header and the band read as one
 * (`atoms/unionBarMatch.ts`). In the app it wears its area's colour on every
 * route, whatever band leads: Build, the Training Bay, is pilot orange with
 * ink; Play, the Cantina, the deep crawler pink with paper. Its colours are
 * the `--su-bar-*` properties on `.su-union-bar`; the site footer wears the
 * leading band too (`footerMatchCss`).
 */

type AppBarProduct = 'reference' | 'build' | 'play'

type AppBarNavItem = {
  label: ReactNode
  href: string
  /** Names the item for "here" (`data-nav`), which the app marks as it routes. */
  id?: string
  /** Marks the link as the page you are on (`aria-current="page"`). */
  active?: boolean
  /** Opens in a new tab via a plain anchor (bypasses LinkComponent). */
  external?: boolean
  /** Optional trailing pill (e.g. an "Alpha" tag). */
  badge?: ReactNode
}

/**
 * A nav entry the app renders itself — a control, not a link (The app's Games
 * menu). It takes its place in the nav's order and the bar knows nothing of it.
 */
export type AppBarNavSlot = {
  id: string
  node: ReactNode
}

export type AppBarNavEntry = AppBarNavItem | AppBarNavSlot

/**
 * One mode's nav. The bar shows the nav of the mode it wears (`data-mode`,
 * `styles/partials/shell.css`), so a bar that changes mode in place carries
 * each mode's.
 */
export type AppBarNav = {
  mode: AppBarProduct
  /** Its landmark's name ("Build navigation"). */
  label: string
  items: AppBarNavEntry[]
}

type AppBarProps = {
  /** The tool this bar is mounted in: its switcher tab is the inverse stamp. */
  product: AppBarProduct
  /** Where "Reference" goes — the SRD's home. */
  referenceHref: string
  /** Where "Build" goes — the app's home. */
  buildHref: string
  /** Where "Play" goes — the Play landing. */
  playHref: string
  /** Link component for the brand + internal links. Defaults to a plain anchor. */
  LinkComponent?: ElementType
  /**
   * The SU mark's URL. The app's own copy: the app serves its files under
   * `/build/` (ADR-048), so the root's is the reference site's on one origin and missing on
   * any other.
   */
  markSrc?: string
  viewTransitionName?: string
  /** The product's own nav (desktop), inline beside the switcher: one per mode it can wear. */
  navs?: AppBarNav[]
  /**
   * Desktop search slot — the site's one `SearchField` combobox,
   * `su-union-bar__search-input` wide.
   */
  search?: ReactNode
  /** "Buy the game" outbound link. Omit to hide. */
  buyHref?: string
  /**
   * Desktop controls at the right end of the bar — app-owned (The app's account
   * menu). A slot rather than nav data because these are controls, not links.
   * Desktop only: the `mobile` slot carries whatever the app wants below `lg`.
   */
  actions?: ReactNode
  /** Mobile cluster (search trigger + hamburger drawer), shown below `lg`. */
  mobile?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
}

// Its ground and ink are `.su-union-bar`'s: a page's leading band recolours
// them (`unionBarMatch.ts`), which a style object would outrank. No rule under
// it: the bar meets the page's header with no black border.
const BAR = {
  isolation: 'isolate',
  position: 'relative',
  zIndex: layer.overlay,
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
  outlineColor: 'var(--su-bar-fg-30)',
  outlineOffset: `calc(-1 * ${borderWidth.chrome})`,
  outlineStyle: 'solid',
  outlineWidth: borderWidth.chrome,
  overflow: 'hidden',
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
      data-nav={item.id}
      {...(item.external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : { 'aria-current': item.active ? ('page' as const) : undefined })}
    >
      {item.label}
      {item.badge}
    </Link>
  )
}

export function AppBar({
  product,
  referenceHref,
  buildHref,
  playHref,
  LinkComponent = 'a',
  markSrc = MARK_SRC,
  viewTransitionName,
  navs = [],
  search,
  buyHref,
  actions,
  mobile,
  breadcrumbs,
}: AppBarProps) {
  const hasCrumbs = breadcrumbs !== undefined && breadcrumbs.length > 0

  // The switcher: same-tab anchors to each mode's home — tabs on one bar,
  // not off-site links. Their hrefs are site paths, whichever is current.
  const tabs: { key: AppBarProduct; label: string; href: string }[] = [
    { key: 'reference', label: 'Reference', href: referenceHref },
    { key: 'build', label: 'Build', href: buildHref },
    { key: 'play', label: 'Play', href: playHref },
  ]

  const navLinks = (items: AppBarNavEntry[]) =>
    items.map((entry) =>
      isSlot(entry) ? (
        <Fragment key={entry.id}>{entry.node}</Fragment>
      ) : (
        <NavLink key={entry.href} item={entry} className={LINK} LinkComponent={LinkComponent} />
      )
    )

  return (
    <>
      <header
        className="su-union-bar"
        // The mode's colour and nav (`styles/partials/shell.css`): the
        // reference's ink, Build's pilot orange, Play's deep crawler pink. The
        // app's shell is marked for its route; the app moves it as it routes.
        data-mode={product}
        style={viewTransitionName ? { ...BAR, viewTransitionName } : BAR}
      >
        {/* Both grains are served; the ground's shows (`.su-union-bar__grain`). */}
        <span className="su-union-bar__grain su-union-bar__grain--paper">
          <Speckle grain="paper" />
        </span>
        <span className="su-union-bar__grain su-union-bar__grain--ink">
          <Speckle grain="ink" />
        </span>
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

          <nav aria-label="Salvage Union tools" className="su-union-bar__switch" style={SWITCH}>
            {tabs.map((tab) => (
              <a
                key={tab.key}
                href={tab.href}
                className={cn('su-union-bar__tab', TAB_CAPS, FOCUS_RING)}
                data-tool={tab.key}
                // Last, where the shell's marking adds it (`markUnionRoute`).
                aria-current={tab.key === product ? 'true' : undefined}
              >
                {tab.label}
              </a>
            ))}
          </nav>

          {navs.map((nav) => (
            <nav
              key={nav.mode}
              aria-label={nav.label}
              className="su-union-bar__nav"
              data-mode={nav.mode}
            >
              {navLinks(nav.items)}
            </nav>
          ))}

          {hasCrumbs && <BreadcrumbTrail breadcrumbs={breadcrumbs} placement="bar" />}

          {/* Desktop: the right-hand cluster, pushed to the end. */}
          <div className="su-union-bar__end">
            {search}
            {buyHref && (
              <a
                href={buyHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('su-union-bar__buy', capsLabel({ tracking: 'snug' }), FOCUS_RING)}
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

      {hasCrumbs && <BreadcrumbTrail breadcrumbs={breadcrumbs} placement="row" />}
    </>
  )
}
