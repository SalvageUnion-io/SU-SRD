import type { LinkProps } from '@tanstack/react-router'
import { useRouter } from '@tanstack/react-router'
import { PRODUCT } from 'cantina-domain/product'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { borderWidth, color } from '../../../ui/design/tokens'
import type { NavDrawerItem } from '../../../ui/index'
import { Badge, NavDrawer } from '../../../ui/index'
import { DOC_PAGES } from '../../lib/docPages'
import { inAppRoute, isCurrent } from '../../lib/unionBar'
import type { UnionSlot } from '../../shell/unionSlots'
import { slotSelector, UNION_NAV, UNION_SLOTS } from '../../shell/unionSlots'
import { AppLink } from './AppLink'

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
 * About and Changelog are not destinations in the nav: they sit at the
 * drawer's foot, in the account menu on a signed-in desktop, and in the page
 * foot (`SiteFooter`). The drawer's Discord entry is the SRD's `/discord` page,
 * in this tab; only "Buy the game" leaves the site, in a new one.
 */

const BUY_HREF = 'https://leyline.press/collections/salvage-union'

const BRAND_FRAME = {
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  display: 'inline-flex',
  flexShrink: 0,
} satisfies CSSProperties

// Narrower than the full rung's 8px inline padding.
const BRAND_PLATE = { paddingInline: '6px' } satisfies CSSProperties

// No inset ring: the outer span draws the ink frame, so the inverse plate's
// own ring would double the seam.
const BRAND_PLATE_INVERSE = { ...BRAND_PLATE, boxShadow: 'none' } satisfies CSSProperties

/** The product name in two plates: all but its last word, then the last word inverse. */
const BRAND_SPLIT = PRODUCT.name.lastIndexOf(' ')

/** The Cantina's two-tone brand tag for the mobile drawer. */
const CANTINA_DRAWER_BRAND = (
  <span style={BRAND_FRAME}>
    <Badge shape="stamp" size="full" style={BRAND_PLATE}>
      {PRODUCT.name.slice(0, BRAND_SPLIT)}
    </Badge>
    <Badge shape="stamp" size="full" surface="inverse" style={BRAND_PLATE_INVERSE}>
      {PRODUCT.name.slice(BRAND_SPLIT + 1)}
    </Badge>
  </span>
)

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
      const nav = UNION_NAV.find((item) => link.textContent === item.label)
      if (!nav) continue
      if (isCurrent(nav.path, pathname)) link.setAttribute('aria-current', 'page')
      else link.removeAttribute('aria-current')
    }
  }, [pathname])

  const drawerNav: NavDrawerItem[] = [
    ...UNION_NAV.map((item) => ({
      label: item.label,
      href: item.path,
      active: isCurrent(item.path, pathname),
    })),
    DOC_PAGES.discord,
    { label: 'Buy the game', href: BUY_HREF, external: true },
  ]

  const mobile = (
    <>
      {mobileSearch}
      {mobileActions}
      <NavDrawer
        brand={CANTINA_DRAWER_BRAND}
        navItems={drawerNav}
        footItems={[DOC_PAGES.about, DOC_PAGES.changelog, DOC_PAGES.api]}
        extra={drawerExtra}
        LinkComponent={AppLink}
        // NavDrawer takes classes, not styles, here: its own padding and
        // width are stylesheet rules these override (`styles/screens.css`).
        triggerClassName="su-union-slots__drawer-trigger"
        panelClassName="su-union-slots__drawer-panel"
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
