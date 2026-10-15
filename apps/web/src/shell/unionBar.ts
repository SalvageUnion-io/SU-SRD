/**
 * The Union bar as the Cantina's shell serves it: the one `UnionBar`
 * (`components/unionBar/UnionBar.tsx`) on its **Build** side, rendered once
 * at build time, so the bar is in the document before any JavaScript runs, as
 * the reference pages' is.
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

import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { UnionBar } from '../components/unionBar/UnionBar'
import type { UnionSlot } from './unionSlots'

const slot = (name: UnionSlot) =>
  createElement('div', { 'data-union-slot': name, style: { display: 'contents' } })

/** The skip link, the banner slot and the bar, ahead of the app's root. */
export function renderUnionBar(): string {
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      // Skip link (WCAG 2.4.1), the SRD's: the first focusable thing on the page.
      createElement('a', { href: '#main-content', className: 'su-skip-link' }, 'Skip to content'),
      slot('banner'),
      createElement(UnionBar, {
        product: 'build',
        games: slot('games'),
        search: slot('search'),
        actions: slot('actions'),
        mobile: slot('mobile'),
      })
    )
  )
}
