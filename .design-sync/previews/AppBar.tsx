/* Ported from packages/component-lib/src/components/shared/AppBar.stories.tsx. */
import { AppBar, SearchField } from 'component-lib'

const NAV = [
  { label: 'SRD', href: '/', active: true },
  { label: 'ABOUT', href: '/about/' },
  { label: 'CHANGELOG', href: '/changelog/' },
  { label: 'API', href: '/api/' },
  { label: 'BUILDER ↗', href: 'https://intheunionnow.com', external: true },
]

/**
 * The shared masthead both Salvage Union surfaces are built from — the brand
 * lockup plus a config-driven right-side cluster (nav links, a search slot, a
 * Buy button) and an optional breadcrumb bar. The SRD's `SiteHeader` and ITUN's
 * `AppHeader` are thin presets over this.
 *
 * Shown in the SRD configuration on a schema item route: active nav, search, and
 * a full breadcrumb trail.
 */
export function WithBreadcrumbs() {
  return (
    <AppBar
      wordmark="SalvageUnion"
      wordmarkAccent=".io"
      eyebrow="The Salvage Union SRD"
      navItems={NAV}
      search={<SearchField placeholder="Search…" aria-label="Search the SRD" />}
      buyHref="https://leyline.press/collections/salvage-union"
      breadcrumbs={[
        { name: 'SRD', url: '/' },
        { name: 'Chassis', url: '/schema/chassis/' },
        { name: 'Iron Mongrel', url: '/schema/chassis/item/iron-mongrel/' },
      ]}
      breadcrumbDescription="Tech Level 1 Mech Chassis"
    />
  )
}

/** A top-level route — no breadcrumb bar beneath the masthead. */
export function TopLevel() {
  return (
    <AppBar
      wordmark="SalvageUnion"
      wordmarkAccent=".io"
      eyebrow="The Salvage Union SRD"
      navItems={NAV}
      search={<SearchField placeholder="Search…" aria-label="Search the SRD" />}
      buyHref="https://leyline.press/collections/salvage-union"
    />
  )
}
