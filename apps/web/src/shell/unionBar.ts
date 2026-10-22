/**
 * The Union bar as the app's shell serves it: the one `UnionBar`
 * (`components/unionBar/UnionBar.tsx`) on the app's side, rendered once at
 * build time, so the bar is in the document before any JavaScript runs, as
 * the reference pages' is.
 *
 * It carries both modes' navs, Build's and Play's, and is rendered on
 * Build's front door. One shell answers every route, so whoever serves it
 * marks it for the route it is served on before it leaves (`markUnionRoute`,
 * `worker/shellMeta.ts`: the Worker and the dev server): the right tab,
 * nav and nav item from the first paint, never Build's fixed up after boot.
 *
 * The bar is static. What in it is live, the Games menu, the search, the account
 * and the phone's drawer, the app renders into the empty slots below through
 * portals (`components/shared/UnionBarSlots.tsx`; the slot names: `./unionSlots`). Each slot is a
 * `display: contents` box, so an empty one takes no room and a filled one lays
 * out as the bar's own children would.
 *
 * Its links are plain anchors under the base (`/build/…`); the app routes a
 * click on one in place and moves "here" as it routes.
 */

import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SkipLink } from '../components/atoms/SkipLink'
import { UnionBar } from '../components/unionBar/UnionBar'
import type { UnionMode, UnionNavId } from '../lib/barLinks'
import type { UnionSlot } from './unionSlots'

const slot = (name: UnionSlot) =>
  createElement('div', { 'data-union-slot': name, style: { display: 'contents' } })

/**
 * The skip link, the banner slot and the bar, ahead of the app's root: on
 * Build's front door unless told where (a test renders each route's).
 */
export function renderUnionBar(
  where: { mode: UnionMode; nav: UnionNavId | null } = { mode: 'build', nav: 'hangar' }
): string {
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      // The skip link the reference layout draws too: the first focusable thing on the page.
      createElement(SkipLink),
      slot('banner'),
      createElement(UnionBar, {
        product: where.mode,
        here: where.nav,
        games: slot('games'),
        search: slot('search'),
        actions: slot('actions'),
        mobile: slot('mobile'),
      })
    )
  )
}
