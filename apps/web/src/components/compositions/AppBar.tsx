import { ArrowUpRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { iconSize, layer, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { MARK_SRC } from '../../lib/documentHead'
import { compositionsCopy } from '../../messages/components-compositions'
import type { BreadcrumbItem } from '../atoms/BreadcrumbTrail'
import { BreadcrumbTrail } from '../atoms/BreadcrumbTrail'
import { capsLabel } from '../atoms/capsLabel'
import { FOCUS_RING } from '../atoms/interaction'
import { Speckle } from '../atoms/Speckle'
import type { Area } from '../unionBar/areaNav.model'
import { AREA_NAV } from '../unionBar/areaNav.model'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

/** The switcher's tabs keep their rule's tracking, which steps with the bar's width. */
const TAB_CAPS = capsLabel({ tracking: 'inherit' })

/**
 * AppBar — the Union bar: the one masthead both SU tools wear (ruleset §3.11,
 * "One union, two tools"). Both render modes draw it through
 * one preset, `unionBar/UnionBar.tsx`.
 *
 * One lockup (the SU mark alone, no wordmark), then the areas as plain
 * header links, **Reference | Build | Play** (a phone reads REF for the
 * first), "Buy the game" after them (off-site: a new tab, its arrow), the
 * search slot and the app's account controls; under the bar, the open area's
 * rail. A page's own modes (a pilot's Read | Edit | Play) live on that page.
 * Crossing is a link on the same bar, never an off-site one. The area you are
 * in is underlined, never rust (§3.1). The shell's bar is marked for the
 * route it is served on (`markUnionRoute`), and the app moves the current
 * link as it routes (`UnionBarSlots`, by each link's `data-tool`).
 *
 * ## One geometry
 *
 * Both tools wear the same bar (one product at one domain): one
 * 56px row at every width (below `lg` the search takes a full-width row of
 * its own under it), one height for the mark and every control in it
 * (`--su-union-bar-control`, `styles/partials/shell.css`), and the search entry at the same
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
 * Presentational: the search, actions and mobile
 * drawer are slots. Every link is a plain site-path anchor (the logo the
 * site's root), and an `external` item opens a
 * new tab. So the shared library stays free of a router, search or account
 * dependency.
 *
 * Paper flecks lie behind the bar's content (`Speckle`, §3.5).
 *
 * ## Colour
 *
 * The bar is paper on ink-deep on every page and in every mode, whatever
 * band leads (chrome K13); the site footer wears the same. Its colours are
 * the `--su-bar-*` properties on `.su-union-bar`.
 */

type AppBarProduct = 'reference' | 'build' | 'play'

type AppBarProps = {
  /** The tool this bar is mounted in: its switcher tab is the inverse stamp. */
  product: AppBarProduct
  /** The site's front door (`/`) is in no area: no link is marked current. */
  noCurrent?: boolean
  /** Where "Reference" goes — the SRD's home. */
  referenceHref: string
  /** Where "Build" goes — the app's home. */
  buildHref: string
  /** Where "Play" goes — Your Games. */
  playHref: string
  /**
   * The SU mark's URL. The app's own copy: the app serves its files under
   * `/build/` (ADR-048), so the root's is the reference site's on one origin and missing on
   * any other.
   */
  markSrc?: string
  viewTransitionName?: string
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

// Its ground and ink are `.su-union-bar`'s `--su-bar-*` properties. No rule under
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

// The site's three areas as plain header links (best, revision 8), not a
// framed toggle: the current one is underlined, as the rail marks its own.
const SWITCH = {
  display: 'inline-flex',
  flexShrink: 0,
  gap: space[4],
} satisfies CSSProperties

export function AppBar({
  product,
  referenceHref,
  buildHref,
  playHref,
  markSrc = MARK_SRC,
  viewTransitionName,
  search,
  buyHref,
  actions,
  mobile,
  breadcrumbs,
  noCurrent = false,
}: AppBarProps) {
  const hasCrumbs = breadcrumbs !== undefined && breadcrumbs.length > 0

  // The switcher: same-tab anchors to each mode's home — tabs on one bar,
  // not off-site links. Their hrefs are site paths, whichever is current.
  // `short`, where given, is the tab's label below `sm` (`data-short`, drawn by
  // `shell.css`); its name stays `label`.
  const tabs: { key: AppBarProduct; label: string; short?: string; href: string }[] = [
    {
      key: 'reference',
      label: compositionsCopy('reference'),
      short: compositionsCopy('ref'),
      href: referenceHref,
    },
    { key: 'build', label: compositionsCopy('build'), href: buildHref },
    { key: 'play', label: compositionsCopy('play'), href: playHref },
  ]

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
          {/* The lockup is the mark alone; its alt names the link. A plain
              anchor to the site's root, the marketing home, on every surface:
              the app's link component would route "/" to the app's own home. */}
          <a href="/" className={cn('su-union-bar__brand', FOCUS_RING)} style={BRAND}>
            <img
              src={markSrc}
              alt={compositionsCopy('salvageUnion')}
              width={40}
              height={40}
              // A 40px mark: low priority also stops React's SSR hoisting a
              // `<link rel="preload">` for it ahead of the hero art and fonts.
              fetchPriority="low"
              className="su-union-bar__mark"
              style={MARK}
            />
          </a>

          <nav
            aria-label={compositionsCopy('salvageUnionTools')}
            className="su-union-bar__switch"
            style={SWITCH}
          >
            {tabs.map((tab) => (
              <a
                key={tab.key}
                href={tab.href}
                className={cn('su-union-bar__tab', TAB_CAPS, FOCUS_RING)}
                data-tool={tab.key}
                // Last, where the shell's marking adds it (`markUnionRoute`).
                aria-current={!noCurrent && tab.key === product ? 'true' : undefined}
                {...(tab.short ? { 'aria-label': tab.label, 'data-short': tab.short } : {})}
              >
                {tab.short ? (
                  <span className="su-union-bar__tab-long">{tab.label}</span>
                ) : (
                  tab.label
                )}
              </a>
            ))}
            {/* The store, right after the areas, a word as they are. */}
            {buyHref && (
              <a
                href={buyHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('su-union-bar__buy', TAB_CAPS, FOCUS_RING)}
              >
                {compositionsCopy('buyTheGame')}
                <ArrowUpRight aria-hidden="true" size={iconSize.compact} />
                <span className="su-sr-only"> {compositionsCopy('opensInNewTab')}</span>
              </a>
            )}
          </nav>

          {hasCrumbs && <BreadcrumbTrail breadcrumbs={breadcrumbs} placement="bar" />}

          {/* Desktop: the right-hand cluster, pushed to the end. Below `lg`
              only its search shows, on a row of its own under the bar. */}
          <div className="su-union-bar__end">
            {search && <div className="su-union-bar__search">{search}</div>}
            {actions && <div className="su-union-bar__actions">{actions}</div>}
          </div>

          {/* Mobile: search trigger + hamburger, below `lg`. */}
          {mobile && <div className="su-union-bar__mobile">{mobile}</div>}
        </div>
        {/* The area's own contents, one row under the
            bar from `lg`. Not ADR-066's second nav (which repeated the tabs):
            it lists what is INSIDE the open area, as D&D Beyond's and
            Demiplane's section menus do, so any listing is one press from
            any page. A phone reads the same map in the drawer. */}
        {/* The front door (`noCurrent`) is in no area, so it carries no rail. */}
        {!noCurrent &&
          (Object.keys(AREA_NAV) as Area[]).map((area) => (
            // All three are served; the bar's `data-mode` shows its own
            // (`best-site.css`), so the rail follows the app's route marking.
            <nav
              key={area}
              className="su-union-bar__rail"
              data-area={area}
              aria-label={compositionsCopy('railIn', { area: AREA_NAV[area].name })}
            >
              {AREA_NAV[area].links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={cn('su-union-bar__rail-link', CAPS, FOCUS_RING)}
                >
                  {link.label}
                </a>
              ))}
              {/* The open page's acts land here
                (`RailActs`), right-aligned on the links' line. */}
              <span className="su-union-bar__rail-acts" data-rail-acts="" />
            </nav>
          ))}
      </header>

      {hasCrumbs && <BreadcrumbTrail breadcrumbs={breadcrumbs} placement="row" />}
    </>
  )
}
