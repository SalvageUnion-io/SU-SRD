import type { CSSProperties, ElementType, ReactNode } from 'react'
import { borderWidth, color, fontSize, space } from '../../design/tokens'
import { NAV_CATALOG } from '../../generated/navCatalog'
import { SIGN_IN_HREF } from '../../lib/accountBar'
import { readAccountHint } from '../../lib/accountHint'
import { browserStorage } from '../../lib/accountState'
import { BUY_HREF, DOC_PAGES } from '../../lib/docPages'
import type { NavDrawerItem } from '../index'
import { Badge, Button, NavDrawer } from '../index'

/**
 * UnionDrawer — the Union bar's one phone drawer, the same in both render
 * modes: the reference pages mount it as `MobileNavIsland`, the app in its
 * bar's `mobile` slot (`UnionBarSlots`).
 *
 * The wordmark home, the search, the book's chapter index with its counts
 * (`NAV_CATALOG`, frozen at build time: building it at runtime would pull the
 * reference ORM onto every page, which `reference-bundle-budget.e2e.ts` forbids), then the
 * site's pages and "Buy the game". The app adds its own nav ahead of those
 * (`productNav`) and its account controls (`extra`); without them the drawer
 * offers Sign in while nobody is signed in, from the account hint.
 */

/** The wordmark's frame: one ink rule around both stamps. */
const BRAND_FRAME = {
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  cursor: 'pointer',
  display: 'inline-flex',
  flexShrink: 0,
} satisfies CSSProperties

// 1.25rem sits above the stamp ladder's top rung (`full` = 0.875rem), so the
// wordmark keeps an explicit size over the rung, inline over its class.
const BRAND_STAMP = {
  fontSize: fontSize.xl,
  letterSpacing: 'normal',
  lineHeight: 'calc(1.75 / 1.25)',
  paddingBlock: space[2],
  paddingInline: space[4],
} satisfies CSSProperties

// No inset ring: the frame above draws the ink rule.
const BRAND_STAMP_INVERSE = { ...BRAND_STAMP, boxShadow: 'none' } satisfies CSSProperties

const BRAND = (
  <a href="/">
    <span style={BRAND_FRAME}>
      <Badge shape="stamp" size="full" style={BRAND_STAMP}>
        Salvage Union
      </Badge>
      <Badge shape="stamp" size="full" surface="inverse" style={BRAND_STAMP_INVERSE}>
        SRD
      </Badge>
    </span>
  </a>
)

/** Sign in, atop the drawer while nobody is signed in; signed in, the bar's avatar is the account. */
function signInFromHint(): ((close: () => void) => ReactNode) | undefined {
  if (readAccountHint(browserStorage()) !== null) return undefined
  return () => (
    // A site path, loaded as a document: the drawer is the shell's, not the router's.
    <Button href={SIGN_IN_HREF} linkAs="a" variant="primary" size="compact">
      Sign in with Discord
    </Button>
  )
}

type UnionDrawerProps = {
  /** The search field at the drawer's head. */
  search?: ReactNode
  /** The product's own nav (the app's Hangar and Starter Set), ahead of the site's pages. */
  productNav?: NavDrawerItem[]
  /** App-owned controls at the drawer's top, handed `close`; defaults to Sign in from the hint. */
  extra?: (close: () => void) => ReactNode
  /** Link component for internal items; the app routes its own in place. */
  LinkComponent?: ElementType
}

export function UnionDrawer({
  search,
  productNav = [],
  extra = signInFromHint(),
  LinkComponent,
}: UnionDrawerProps) {
  const path = typeof location === 'undefined' ? '/' : location.pathname
  const page = (link: { label: string; href: string }): NavDrawerItem => ({
    ...link,
    active: path.startsWith(link.href.replace(/\/$/, '')),
  })

  const navItems: NavDrawerItem[] = [
    ...productNav,
    page(DOC_PAGES.about),
    page(DOC_PAGES.changelog),
    page(DOC_PAGES.discord),
    page(DOC_PAGES.api),
    { label: 'Buy the game', href: BUY_HREF, external: true },
  ]

  return (
    <NavDrawer
      brand={BRAND}
      categories={[...NAV_CATALOG]}
      search={search}
      navItems={navItems}
      extra={extra}
      LinkComponent={LinkComponent}
    />
  )
}
