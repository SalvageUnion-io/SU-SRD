import { ArrowUpRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { iconSize, layer, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { MARK_SRC } from '../../lib/documentHead'
import { compositionsCopy } from '../../messages/components-compositions'
import type { BreadcrumbItem } from '../atoms/BreadcrumbTrail'
import { BreadcrumbTrail } from '../atoms/BreadcrumbTrail'
import { Button } from '../atoms/Button'
import { capsLabel } from '../atoms/capsLabel'
import { FOCUS_RING } from '../atoms/interaction'
import { Speckle } from '../atoms/Speckle'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

/** The switcher's tabs keep their rule's tracking, which steps with the bar's width. */
const TAB_CAPS = capsLabel({ tracking: 'inherit' })

/**
 * AppBar — the Union bar: the one masthead both SU tools wear (ruleset §3.11,
 * "One union, two tools"). Both render modes draw it through
 * one preset, `unionBar/UnionBar.tsx`.
 *
 * One lockup (the SU mark alone, no wordmark), then the **Reference | Training
 * Bay | Games** switcher (ADR-066), the search slot, "Buy the game" and the
 * app's account controls. There is no second nav: each tab is a place, and a
 * page's own modes (a pilot's Read | Edit | Play) live on that page. Crossing
 * is a tab on the same bar, never an off-site link. The tab you are on is an
 * inverse stamp — a paper plate on the ink bar — and never rust (§3.1). The
 * shell's bar is marked for the route it is served on (`markUnionRoute`), and
 * the app moves the current tab as it routes (`UnionBarSlots`, by each tab's
 * `data-tool`).
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
 * The bar wears its mode (`data-mode`). In the reference it is ink, paper on
 * it, until a page leads with a chapter band: then it wears that band's
 * colour, foreground and grain, so the site header and the band read as one
 * (`atoms/unionBarMatch.ts`). In the app it wears its area's colour on every
 * route, whatever band leads: the Training Bay is pilot orange with ink; the
 * Games, the deep crawler pink with paper. Its colours are
 * the `--su-bar-*` properties on `.su-union-bar`; the site footer wears the
 * leading band too (`footerMatchCss`).
 */

type AppBarProduct = 'reference' | 'build' | 'play'

type AppBarProps = {
  /** The tool this bar is mounted in: its switcher tab is the inverse stamp. */
  product: AppBarProduct
  /** The site's front door (`/`) is in no area: no link is marked current. */
  noCurrent?: boolean
  /** Where "Reference" goes — the SRD's home. */
  referenceHref: string
  /** Where "Training Bay" goes — the app's home. */
  buildHref: string
  /** Where "Games" goes — Your Games. */
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

// The site's three areas as plain header links (best, revision 8), not a
// framed toggle: the current one is underlined, as the rail marks its own.
const SWITCH = {
  display: 'inline-flex',
  flexShrink: 0,
  gap: space[4],
} satisfies CSSProperties

/** What each area holds, for the rail. */
const RAIL: Record<AppBarProduct, { name: string; links: { label: string; href: string }[] }> = {
  reference: {
    name: compositionsCopy('railReference'),
    links: [
      { label: compositionsCopy('railPilots'), href: '/reference/#pilot-bay' },
      { label: compositionsCopy('railMechs'), href: '/reference/#mech-workshop' },
      { label: compositionsCopy('railUnionCrawler'), href: '/reference/#union-crawler' },
      { label: compositionsCopy('railWasteland'), href: '/reference/#denizens' },
      { label: compositionsCopy('railRules'), href: '/reference/#rules-reference' },
      { label: compositionsCopy('railGuides'), href: '/guides/' },
      { label: compositionsCopy('railRollTables'), href: '/roll-tables/' },
    ],
  },
  build: {
    name: compositionsCopy('railYours'),
    links: [
      { label: compositionsCopy('railPilots'), href: '/build/#pilots' },
      { label: compositionsCopy('railMechs'), href: '/build/#mechs' },
      { label: compositionsCopy('railCrawlers'), href: '/build/#crawlers' },
      { label: compositionsCopy('railPatterns'), href: '/build/#patterns' },
      { label: compositionsCopy('railStarterSet'), href: '/build/starter' },
    ],
  },
  play: {
    name: compositionsCopy('railPlay'),
    links: [
      { label: compositionsCopy('railYourGames'), href: '/games/' },
      { label: compositionsCopy('railJoin'), href: '/games/#join' },
      { label: compositionsCopy('railKit'), href: '/games/#kit' },
    ],
  },
}

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
          </nav>

          {hasCrumbs && <BreadcrumbTrail breadcrumbs={breadcrumbs} placement="bar" />}

          {/* Desktop: the right-hand cluster, pushed to the end. Below `lg`
              only its search shows, on a row of its own under the bar. */}
          <div className="su-union-bar__end">
            {search && <div className="su-union-bar__search">{search}</div>}
            {buyHref && (
              <Button
                href={buyHref}
                linkAs="a"
                target="_blank"
                rel="noopener noreferrer"
                variant="ghost"
                size="compact"
                className="su-union-bar__action su-union-bar__buy"
              >
                {compositionsCopy('buyTheGame')}
                <ArrowUpRight aria-hidden="true" size={iconSize.compact} />
              </Button>
            )}
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
          (Object.keys(RAIL) as AppBarProduct[]).map((area) => (
            // All three are served; the bar's `data-mode` shows its own
            // (`best-site.css`), so the rail follows the app's route marking.
            <nav
              key={area}
              className="su-union-bar__rail"
              data-area={area}
              aria-label={compositionsCopy('railIn', { area: RAIL[area].name })}
            >
              {RAIL[area].links.map((link) => (
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
