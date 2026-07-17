import type { ReactNode } from 'react'
import { AppBar, type AppBarNavItem } from './AppBar'

/**
 * SiteHeader — the SRD reference site's masthead. A thin preset over the shared
 * `AppBar`: the SalvageUnion.io brand, the SRD nav (SRD / About / Changelog /
 * Discord / API + outbound Builder cross-link), the "Buy the game" button, and
 * an optional breadcrumb bar with JSON-LD. The interactive search + mobile-nav
 * pieces are slotted (`search` / `mobile`) so the consuming Astro page hydrates
 * them independently.
 */

type BreadcrumbItem = {
  name: string
  url: string
}

type SiteHeaderProps = {
  /** Current pathname, drives the active nav state (e.g. Astro.url.pathname). */
  currentPath: string
  /** Destination for the outbound ITUN builder cross-link. */
  itunUrl: string
  breadcrumbs?: BreadcrumbItem[]
  breadcrumbDescription?: string
  /** Stable `view-transition-name` forwarded to HeaderShell (Astro ClientRouter). */
  viewTransitionName?: string
  /** Desktop search trigger (suref-web slots its SearchIsland here). */
  search?: ReactNode
  /** Mobile cluster — search trigger + hamburger drawer (slotted, hydrated by the site). */
  mobile?: ReactNode
}

export function SiteHeader({
  currentPath,
  itunUrl,
  breadcrumbs,
  breadcrumbDescription,
  viewTransitionName,
  search,
  mobile,
}: SiteHeaderProps) {
  const isActive = (path: string) => currentPath.startsWith(path)

  const navItems: AppBarNavItem[] = [
    { label: 'SRD', href: '/', active: isActive('/schema') || currentPath === '/' },
    { label: 'ABOUT', href: '/about/', active: isActive('/about') },
    { label: 'CHANGELOG', href: '/changelog/', active: isActive('/changelog') },
    { label: 'DISCORD', href: '/discord/', active: isActive('/discord') },
    { label: 'API', href: '/api/', active: isActive('/api') },
    { label: 'BUILDER ↗', href: itunUrl, external: true },
  ]

  return (
    <AppBar
      wordmark="SalvageUnion"
      wordmarkAccent=".io"
      eyebrow="The Salvage Union SRD"
      viewTransitionName={viewTransitionName}
      navItems={navItems}
      search={search}
      buyHref="https://leyline.press/collections/salvage-union"
      buyLabel="BUY THE GAME"
      mobile={mobile}
      breadcrumbs={breadcrumbs}
      breadcrumbDescription={breadcrumbDescription}
    />
  )
}
