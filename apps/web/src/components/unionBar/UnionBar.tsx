import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { appPath } from '../../lib/appBase'
import type { UnionMode, UnionNavId } from '../../lib/barLinks'
import { UNION_NAV } from '../../lib/barLinks'
import { BUY_HREF } from '../../lib/docPages'
import { MARK_SRC } from '../../lib/documentHead'
import type { BreadcrumbItem } from '../atoms/BreadcrumbTrail'
import type { AppBarNav, AppBarNavEntry } from '../compositions/AppBar'
import { AppBar } from '../index'

/**
 * UnionBar — the one Union bar both render modes draw (ruleset §3.11): the
 * reference pages (`TopNavigation`, its live parts islands) and the app's
 * shell (`shell/unionBar.ts`, its live parts portals filling slots). Everything
 * that makes it the same bar is here: the switcher's targets (Reference,
 * Build, Play; Build and Play are the app's, under its base), the mark, "Buy
 * the game", the view-transition name and the app's two navs. The render mode
 * hands in only what it makes live: the search, the account controls and the
 * phone cluster (`UnionDrawer` with its triggers).
 *
 * No router, store or Convex import: the reference pages render it.
 */

type UnionBarProps = {
  /** The tool the page belongs to: its switcher tab is the inverse stamp, and the bar shows its nav. */
  product: 'reference' | UnionMode
  /** The nav item of the page you are on (`unionHere`), marked "here". */
  here?: UnionNavId | null
  /** The app's Games control, Play's nav's first entry. */
  games?: ReactNode
  /** Desktop search, at the start of the bar's right-hand cluster. */
  search?: ReactNode
  /** Desktop account controls at the bar's end. */
  actions?: ReactNode
  /** The phone cluster below `lg`: search trigger, avatar and the drawer. */
  mobile?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
}

/** An app link: a route under the base. */
function BaseLink({ href = '/', ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={appPath(`/${href.replace(/^\/+/, '')}`)} {...rest} />
}

/** One mode's nav links, the page you are on marked. */
const links = (mode: UnionMode, here: UnionNavId | null): AppBarNavEntry[] =>
  UNION_NAV[mode].map((item) => ({
    id: item.id,
    label: item.label,
    href: item.path,
    active: item.id === here,
  }))

/**
 * The app's two navs, both in the bar and the mode's shown (`data-mode`):
 * Build's Hangar · Patterns · Starter Set, and Play's Games ▾ · Solo, Games
 * the app's control.
 */
function appNavs(games: ReactNode, here: UnionNavId | null): AppBarNav[] {
  return [
    { mode: 'build', label: 'Build', items: links('build', here) },
    { mode: 'play', label: 'Play', items: [{ id: 'games', node: games }, ...links('play', here)] },
  ]
}

export function UnionBar({
  product,
  here = null,
  games,
  search,
  actions,
  mobile,
  breadcrumbs,
}: UnionBarProps) {
  const app = product !== 'reference'
  return (
    <AppBar
      product={product}
      // One origin (ADR-048): the reference is the site's root, the app
      // under its base. The tabs are site paths; the app's other links route
      // through `BaseLink`, so they are written as routes.
      referenceHref="/"
      buildHref={appPath('/')}
      playHref={appPath('/play/')}
      LinkComponent={app ? BaseLink : 'a'}
      markSrc={MARK_SRC}
      // Cross-document view transitions match the bar on this name, so it
      // holds still between a reference page and the app.
      viewTransitionName="nav"
      navs={app ? appNavs(games, here) : []}
      search={search}
      buyHref={BUY_HREF}
      actions={actions}
      mobile={mobile}
      breadcrumbs={breadcrumbs}
    />
  )
}
