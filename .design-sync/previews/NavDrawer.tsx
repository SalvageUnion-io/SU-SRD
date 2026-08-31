/*
 * Ported from packages/component-lib/src/components/shared/NavDrawer.stories.tsx.
 *
 * The drawer keeps the story's open-on-mount trick, and it is load-bearing here:
 * the panel is closed by default and the apps pass no `defaultOpen` prop (the
 * story-only one was deleted), so without clicking its own hamburger the card
 * would show a lone trigger button and nothing else.
 */
import { NavDrawer, SearchField } from 'component-lib'
import { useEffect, useRef } from 'react'

function SrdBrand() {
  return (
    <span className="inline-flex shrink-0 border border-ink font-cond text-xl font-bold uppercase leading-none tracking-caps-tight">
      <span className="bg-ink px-1 py-0.5 text-paper">Salvage Union</span>
      <span className="bg-paper px-1 py-0.5 text-ink">SRD</span>
    </span>
  )
}

const CATEGORIES = [
  {
    label: 'Mechs',
    schemas: [
      { id: 'chassis', displayName: 'Chassis', catalogBg: 'var(--color-mech)' },
      { id: 'systems', displayName: 'Systems', catalogBg: 'var(--color-mech-dark)' },
    ],
  },
  {
    label: 'Reference',
    schemas: [
      {
        id: 'traits',
        displayName: 'Traits',
        catalogBg: 'var(--color-ink)',
        catalogLabel: 'var(--color-rust)',
      },
    ],
  },
]

const NAV = [
  { label: 'ABOUT', href: '/about/', active: true },
  { label: 'CHANGELOG', href: '/changelog/' },
  { label: 'DISCORD', href: '/discord/' },
  { label: 'BUILDER ↗', href: 'https://intheunionnow.com', external: true },
  {
    label: 'BUY THE GAME',
    href: 'https://leyline.press/collections/salvage-union',
    external: true,
  },
]

function OpenOnMount({ children }: { children: React.ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    frameRef.current?.querySelector<HTMLButtonElement>('[aria-label="Open menu"]')?.click()
  }, [])
  return <div ref={frameRef}>{children}</div>
}

/**
 * The unified mobile nav drawer in its richest (SRD) form — brand, search,
 * catalog categories, and primary nav links with the active one in rust.
 */
export function SrdForm() {
  return (
    <OpenOnMount>
      <NavDrawer
        brand={<SrdBrand />}
        categories={CATEGORIES}
        search={<SearchField placeholder="Search…" aria-label="Search the SRD" />}
        navItems={NAV}
      />
    </OpenOnMount>
  )
}

/**
 * The same component as the ITUN builder uses it — `navItems` only, no
 * categories and no search, in a narrower panel.
 */
export function BuilderForm() {
  return (
    <OpenOnMount>
      <NavDrawer
        brand={<SrdBrand />}
        navItems={[
          { label: 'ROSTER', href: '/', active: true },
          { label: 'GAMES', href: '/games/' },
          { label: 'ABOUT', href: '/about/' },
        ]}
      />
    </OpenOnMount>
  )
}
