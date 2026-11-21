import type { CSSProperties, ElementType, ReactNode } from 'react'
import { NAV_CATALOG } from '../../generated/navCatalog'
import { SIGN_IN_HREF } from '../../lib/accountBar'
import { readAccountHint } from '../../lib/accountHint'
import { browserStorage } from '../../lib/accountState'
import { BUY_HREF, DOC_PAGES } from '../../lib/docPages'
import { MARK_SRC } from '../../lib/documentHead'
import { unionBarCopy } from '../../messages/components-union-bar'
import { FOCUS_RING } from '../atoms/interaction'
import type { NavDrawerCategory, NavDrawerItem } from '../index'
import { Button, NavDrawer } from '../index'
import type { AreaNav } from './areaNav'
import { AREA_NAV } from './areaNav'

/**
 * UnionDrawer — the Union bar's one phone drawer, the same in both render
 * modes: the reference pages mount it as `MobileNavIsland`, the app in its
 * bar's `mobile` slot (`UnionBarSlots`).
 *
 * The mark home, the search, the book's chapter index with its counts
 * (`NAV_CATALOG`, frozen at build time: building it at runtime would pull the
 * reference ORM onto every page, which `reference-bundle-budget.e2e.ts` forbids), then the
 * site's pages and "Buy the game". The app adds its account controls
 * (`extra`); without them the drawer
 * offers Sign in while nobody is signed in, from the account hint.
 */

// The Union bar's lockup, the mark alone (ruleset §3.11), at the Compact Size.
const MARK = {
  display: 'block',
  height: 'var(--size-compact)',
  width: 'var(--size-compact)',
} satisfies CSSProperties

const BRAND = (
  <a href="/" className={FOCUS_RING}>
    <img src={MARK_SRC} alt={unionBarCopy('salvageUnion')} width={40} height={40} style={MARK} />
  </a>
)

/** Sign in, atop the drawer while nobody is signed in; signed in, the bar's avatar is the account. */
function signInFromHint(): ((close: () => void) => ReactNode) | undefined {
  if (readAccountHint(browserStorage()) !== null) return undefined
  return () => (
    // A site path, loaded as a document: the drawer is the shell's, not the router's.
    <Button href={SIGN_IN_HREF} linkAs="a" variant="primary" size="compact">
      {unionBarCopy('signInWithDiscord')}
    </Button>
  )
}

type UnionDrawerProps = {
  /** The search field at the drawer's head. */
  search?: ReactNode
  /** App-owned controls at the drawer's top, handed `close`; defaults to Sign in from the hint. */
  extra?: (close: () => void) => ReactNode
  /** Link component for internal items; the app routes its own in place. */
  LinkComponent?: ElementType
}

export function UnionDrawer({ search, extra = signInFromHint(), LinkComponent }: UnionDrawerProps) {
  const path = typeof location === 'undefined' ? '/' : location.pathname
  const page = (link: { label: string; href: string }): NavDrawerItem => ({
    ...link,
    active: path.startsWith(link.href.replace(/\/$/, '')),
  })

  const navItems: NavDrawerItem[] = [
    page(DOC_PAGES.about),
    page(DOC_PAGES.changelog),
    page(DOC_PAGES.discord),
    page(DOC_PAGES.api),
    { label: unionBarCopy('buyTheGame'), href: BUY_HREF, external: true },
  ]

  // The drawer is the site's whole map, the three areas
  // in the bar's order. Your own things lead (the Training Bay, then Games);
  // the Reference follows as the book's chapters, as before.
  const area = (id: string, tone: NavDrawerCategory['tone'], { name, links }: AreaNav) => ({
    id,
    tone,
    title: name,
    rows: [...links],
  })
  const AREAS: NavDrawerCategory[] = [
    area('area-training-bay', 'pilot', AREA_NAV.build),
    area('area-games', 'crawler', AREA_NAV.play),
  ]

  return (
    <NavDrawer
      brand={BRAND}
      categories={[...AREAS, ...NAV_CATALOG]}
      search={search}
      navItems={navItems}
      extra={extra}
      LinkComponent={LinkComponent}
    />
  )
}
