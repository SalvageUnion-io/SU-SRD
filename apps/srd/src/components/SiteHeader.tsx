import { AppBar } from 'component-lib'
import type { ReactNode } from 'react'

/**
 * SiteHeader — the SRD's preset of the shared Union bar (`AppBar`, ruleset
 * §3.11): the full-density bar on the **Reference** side of the switcher, the
 * search slot, "Buy the game" and the breadcrumb trail. The interactive search
 * + mobile-nav pieces are slotted (`search` / `mobile`) so the page mounts them
 * as independent islands.
 *
 * There is no second nav row: Contents, Guides, Roll tables and Keywords were
 * the home page's index over again, so the home page is the nav. Changelog,
 * API, Discord and About live in the footer (`Footer.tsx`), and the drawer.
 */

type BreadcrumbItem = {
  name: string
  url: string
}

type SiteHeaderProps = {
  /** Where the switcher's **Build** tab goes: ITUN. */
  itunUrl: string
  breadcrumbs?: BreadcrumbItem[]
  breadcrumbDescription?: string
  /** Stable `view-transition-name` forwarded to AppBar (cross-document view transitions). */
  viewTransitionName?: string
  /** Desktop search (srd slots its SearchIsland here). */
  search?: ReactNode
  /** Mobile cluster — search trigger + hamburger drawer (slotted, hydrated by the site). */
  mobile?: ReactNode
}

export function SiteHeader({
  itunUrl,
  breadcrumbs,
  breadcrumbDescription,
  viewTransitionName,
  search,
  mobile,
}: SiteHeaderProps) {
  return (
    <AppBar
      product="reference"
      referenceHref="/"
      buildHref={itunUrl}
      viewTransitionName={viewTransitionName}
      search={search}
      buyHref="https://leyline.press/collections/salvage-union"
      mobile={mobile}
      breadcrumbs={breadcrumbs}
      breadcrumbDescription={breadcrumbDescription}
    />
  )
}
