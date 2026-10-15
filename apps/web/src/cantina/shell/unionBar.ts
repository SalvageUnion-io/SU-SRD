/**
 * The Union bar as the Cantina's shell serves it: the shared `AppBar` on its
 * **Build** side, rendered once at build time, so the bar is in the document
 * before any JavaScript runs, as srd's is.
 *
 * The bar is static. What in it is live, the Games menu, the search, the account
 * and the phone's drawer, the app renders into the empty slots below through
 * portals (`components/shared/UnionBarSlots.tsx`; the slot names: `./unionSlots`). Each slot is a
 * `display: contents` box, so an empty one takes no room and a filled one lays
 * out as the bar's own children would.
 *
 * Its links are plain anchors under the base (`/build/…`); the app routes a
 * click on one in place and marks the page you are on.
 */

import type { AnchorHTMLAttributes } from 'react'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppBar } from '../../ui/index'
import { SITE } from '../lib/site'
import type { UnionSlot } from './unionSlots'
import { UNION_NAV } from './unionSlots'

const BUY_HREF = 'https://leyline.press/collections/salvage-union'

const slot = (name: UnionSlot) =>
  createElement('div', { 'data-union-slot': name, style: { display: 'contents' } })

/** An internal link: a route under the base. */
function BaseLink({ href = '/', ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return createElement('a', { ...rest, href: `${SITE.base}${href.replace(/^\/+/, '')}` })
}

/** The skip link, the banner slot and the bar, ahead of the app's root. */
export function renderUnionBar(): string {
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      // Skip link (WCAG 2.4.1), the SRD's: the first focusable thing on the page.
      createElement('a', { href: '#main-content', className: 'su-skip-link' }, 'Skip to content'),
      slot('banner'),
      createElement(AppBar, {
        product: 'build',
        // One origin (ADR-048): the reference is the site's root.
        referenceHref: '/',
        buildHref: '/',
        LinkComponent: BaseLink,
        // The Cantina's public copy, root-relative: Vite puts the base in front
        // of an asset tag's URL, dev and build alike.
        markSrc: '/logos/su-cargo-dark.svg',
        // srd's bar wears the same name, so a cross-document view transition
        // between the two apps matches the bar instead of fading it.
        viewTransitionName: 'nav',
        navItems: [
          { label: UNION_NAV[0].label, href: UNION_NAV[0].path },
          { id: 'games', node: slot('games') },
          { label: UNION_NAV[1].label, href: UNION_NAV[1].path },
        ],
        search: slot('search'),
        buyHref: BUY_HREF,
        actions: slot('actions'),
        mobile: slot('mobile'),
      })
    )
  )
}
