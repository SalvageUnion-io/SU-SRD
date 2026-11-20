import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { appPath } from '../../lib/appBase'
import type { UnionMode } from '../../lib/barLinks'
import { BUY_HREF } from '../../lib/docPages'
import { MARK_SRC } from '../../lib/documentHead'
import type { BreadcrumbItem } from '../atoms/BreadcrumbTrail'
import { AppBar } from '../index'

/**
 * UnionBar — the one Union bar both render modes draw (ruleset §3.11): the
 * reference pages (`TopNavigation`, its live parts islands) and the app's
 * shell (`shell/unionBar.ts`, its live parts portals filling slots). Everything
 * that makes it the same bar is here: the switcher's targets (Reference, the
 * Training Bay and the Games, ADR-066), the mark, "Buy the game" and the
 * view-transition name. The render mode
 * hands in only what it makes live: the search, the account controls and the
 * phone cluster (`UnionDrawer` with its triggers).
 *
 * No router, store or Worker-call import: the reference pages render it.
 */

type UnionBarProps = {
  /** The tool the page belongs to: its switcher tab is the inverse stamp. */
  product: 'reference' | UnionMode
  /** Desktop search, at the start of the bar's right-hand cluster. */
  search?: ReactNode
  /** Desktop account controls at the bar's end. */
  actions?: ReactNode
  /** The phone cluster below `lg`: search trigger, avatar and the drawer. */
  mobile?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  /** The site's front door: no area link is current. */
  noCurrent?: boolean
}

/** An app link: a route under the base. */
function BaseLink({ href = '/', ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={appPath(`/${href.replace(/^\/+/, '')}`)} {...rest} />
}

export function UnionBar({
  product,
  search,
  actions,
  mobile,
  breadcrumbs,
  noCurrent,
}: UnionBarProps) {
  const app = product !== 'reference'
  return (
    <AppBar
      product={product}
      // One origin (ADR-048): the reference is the site's root, the app
      // under its base. The tabs are site paths; the app's other links route
      // through `BaseLink`, so they are written as routes.
      referenceHref="/reference/"
      buildHref={appPath('/')}
      playHref={appPath('/games/')}
      LinkComponent={app ? BaseLink : 'a'}
      markSrc={MARK_SRC}
      // Cross-document view transitions match the bar on this name, so it
      // holds still between a reference page and the app.
      viewTransitionName="nav"
      search={search}
      buyHref={BUY_HREF}
      actions={actions}
      mobile={mobile}
      breadcrumbs={breadcrumbs}
      noCurrent={noCurrent}
    />
  )
}
