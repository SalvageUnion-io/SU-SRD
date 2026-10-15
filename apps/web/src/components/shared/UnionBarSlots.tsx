import type { LinkProps } from '@tanstack/react-router'
import { useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { appPath } from '../../lib/appBase'
import { CANTINA_NAV, inAppRoute, isCurrent } from '../../lib/barLinks'
import type { UnionSlot } from '../../shell/unionSlots'
import { slotSelector, UNION_SLOTS } from '../../shell/unionSlots'
import { UnionDrawer } from '../unionBar/UnionDrawer'
import { SiteLink } from './AppLink'

/**
 * UnionBarSlots — the Cantina's live half of the Union bar.
 *
 * The bar itself is the shell's, rendered at build time (`shell/unionBar.ts`),
 * so it paints before the app boots. This fills its slots through portals: the
 * Games menu in the nav, the search and the account at its end, and below `lg`
 * the phone's search, avatar and drawer. Portals keep the app's context, so
 * what goes in a slot reads the connection and the router as if the bar were
 * part of the tree. It also routes a click on one of the bar's own links in
 * place, and marks the nav link of the page you are on.
 *
 * The slots stay content-agnostic, so this file knows nothing about accounts,
 * Convex or Games; `routes/__root.tsx` fills them
 * (`components/account/HeaderAccount.tsx`).
 *
 * The phone drawer is the bar's one `UnionDrawer`, the reference pages' own,
 * with the Cantina's nav ahead of the site's pages and its account controls
 * at the top. Its links are site paths, as the bar's are: `SiteLink` routes the
 * app's in place and loads the reference pages.
 */

type UnionBarSlotsProps = {
  /** The current route, to mark "you are here" in the nav. */
  pathname: string
  /** The nav's Games control, between Hangar and Starter Set. */
  games?: ReactNode
  /** Desktop search trigger, before the account control. */
  search?: ReactNode
  /** Phone search icon button, beside the hamburger below `lg`. */
  mobileSearch?: ReactNode
  /** Desktop controls at the bar's end: the account menu or sign-in. */
  actions?: ReactNode
  /** Mobile controls beside the hamburger, below `lg`: the avatar-only account menu. */
  mobileActions?: ReactNode
  /** The search at the head of the mobile drawer. */
  drawerSearch?: ReactNode
  /** Controls at the top of the mobile drawer, handed `close` to dismiss it. */
  drawerExtra?: (close: () => void) => ReactNode
  /** Above the bar: the not-connected banner, filled even while the bar is hidden. */
  banner?: ReactNode
  /** The route draws no bar (`hidesUnionBar`): only the banner is filled. */
  barHidden?: boolean
}

/** The slot elements in the document, found once the app has mounted. */
function useSlots(): Partial<Record<UnionSlot, Element>> {
  const [slots, setSlots] = useState<Partial<Record<UnionSlot, Element>>>({})
  useLayoutEffect(() => {
    const found: Partial<Record<UnionSlot, Element>> = {}
    for (const name of UNION_SLOTS) {
      const element = document.querySelector(slotSelector(name))
      if (element) found[name] = element
    }
    setSlots(found)
  }, [])
  return slots
}

export function UnionBarSlots({
  pathname,
  games,
  search,
  mobileSearch,
  actions,
  mobileActions,
  drawerSearch,
  drawerExtra,
  banner,
  barHidden = false,
}: UnionBarSlotsProps) {
  // No router in a component test: the bar's links then stay plain anchors.
  const router = useRouter({ warn: false })
  const slots = useSlots()

  // A click on the bar's own links (the lockup, the Build tab, the nav)
  // routes in place, as AppLink does.
  useEffect(() => {
    const bar = document.querySelector('.su-union-bar')
    if (!bar || !router) return
    const onClick = (event: Event) => {
      const to = inAppRoute(event as MouseEvent)
      if (to === null) return
      event.preventDefault()
      void router.navigate({ to: to as LinkProps['to'] })
    }
    bar.addEventListener('click', onClick)
    return () => bar.removeEventListener('click', onClick)
  }, [router])

  // "You are here" on the nav, which the shell cannot know.
  useEffect(() => {
    for (const link of document.querySelectorAll<HTMLAnchorElement>('.su-union-bar__nav a')) {
      const nav = CANTINA_NAV.find((item) => link.textContent === item.label)
      if (!nav) continue
      if (isCurrent(nav.path, pathname)) link.setAttribute('aria-current', 'page')
      else link.removeAttribute('aria-current')
    }
  }, [pathname])

  const mobile = (
    <>
      {mobileSearch}
      {mobileActions}
      <UnionDrawer
        search={drawerSearch}
        productNav={CANTINA_NAV.map((item) => ({
          label: item.label,
          href: appPath(item.path),
          active: isCurrent(item.path, pathname),
        }))}
        extra={drawerExtra}
        LinkComponent={SiteLink}
      />
    </>
  )

  const fill: Record<UnionSlot, ReactNode> = barHidden
    ? { banner, games: null, search: null, actions: null, mobile: null }
    : { banner, games, search, actions, mobile }
  return (
    <>
      {UNION_SLOTS.map((name) => {
        const element = slots[name]
        return element && fill[name] ? createPortal(fill[name], element, name) : null
      })}
    </>
  )
}
