import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { appPath } from '../../lib/appBase'
import { BUILD_NAV } from '../../lib/barLinks'
import { BUY_HREF } from '../../lib/docPages'
import { MARK_SRC } from '../../lib/documentHead'
import type { BreadcrumbItem } from '../atoms/BreadcrumbTrail'
import type { AppBarNavEntry } from '../compositions/AppBar'
import { AppBar } from '../index'

/**
 * UnionBar — the one Union bar both render modes draw (ruleset §3.11): the
 * reference pages (`TopNavigation`, its live parts islands) and the app's
 * shell (`shell/unionBar.ts`, its live parts portals filling slots). Everything
 * that makes it the same bar is here: the switcher's targets (Reference,
 * Build, Play; Play is the app's, under its base), the mark, "Buy
 * the game", the view-transition name and the app's nav. The render mode
 * hands in only what it makes live: the search, the account controls and the
 * phone cluster (`UnionDrawer` with its triggers).
 *
 * No router, store or Convex import: the reference pages render it.
 */

type UnionBarProps = {
  /** The tool the page belongs to: its switcher tab is the inverse stamp. */
  product: 'reference' | 'build'
  /** The app's Games control, between Hangar and Starter Set. */
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
  return <a {...rest} href={appPath(`/${href.replace(/^\/+/, '')}`)} />
}

/** The app's nav: Hangar · Games · Starter Set, Games the app's control. */
function buildNav(games: ReactNode): AppBarNavEntry[] {
  const [hangar, starter] = BUILD_NAV
  return [
    { label: hangar.label, href: hangar.path },
    { id: 'games', node: games },
    { label: starter.label, href: starter.path },
  ]
}

export function UnionBar({ product, games, search, actions, mobile, breadcrumbs }: UnionBarProps) {
  const build = product === 'build'
  return (
    <AppBar
      product={product}
      // One origin (ADR-048): the reference is the site's root, the app
      // under its base. On the app's side its own links route through
      // `BaseLink`, so they are written as routes.
      referenceHref="/"
      buildHref={build ? '/' : appPath('/')}
      // Never the current tab as served (the app's shell is Build's), so
      // always a plain anchor, written as the site path.
      playHref={appPath('/play/')}
      LinkComponent={build ? BaseLink : 'a'}
      markSrc={MARK_SRC}
      // Cross-document view transitions match the bar on this name, so it
      // holds still between a reference page and the app.
      viewTransitionName="nav"
      navItems={build ? buildNav(games) : []}
      search={search}
      buyHref={BUY_HREF}
      actions={actions}
      mobile={mobile}
      breadcrumbs={breadcrumbs}
    />
  )
}
