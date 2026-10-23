import { Drawer } from '@base-ui/react/drawer'
import { ExternalLink, Menu } from 'lucide-react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useState } from 'react'
import { color, iconSize, layer, radius, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { compositionsCopy } from '../../messages/components-compositions'
import { Button } from '../atoms/Button'
import { CloseButton } from '../atoms/CloseButton'
import { FOCUS_RING } from '../atoms/interaction'
import { TRANSITION_COLORS } from '../atoms/transition'
import type { ContentsChapterProps } from './ContentsChapter'
import { ContentsChapter } from './ContentsChapter'

/**
 * NavDrawer — the hamburger + slide-in mobile nav drawer under the Union bar's
 * one phone drawer (`unionBar/UnionDrawer.tsx`). One Base UI `Drawer`: a
 * hamburger trigger, the shared `.su-backdrop` scrim, and a right-side panel
 * that slides in (`.su-drawer`) and can be swiped back out.
 *
 * Content is fully driven by props: a `brand` lockup, an optional `search`
 * slot, an optional `extra` slot for app-owned controls (the app's Games list
 * and sign-in), the index `categories` (the SRD's chapters, drawn as the home
 * page's Contents: `ContentsChapter`), then the `navItems`, rows of the same
 * index. The page you are on is ruled under in ink, never rust (ruleset
 * §3.1, §3.11). Router-agnostic: internal items render through the injected
 * `LinkComponent` (defaults to a plain anchor), external ones as
 * `<a target=_blank>`. Every item closes the drawer on tap.
 *
 * `extra` is a render function, not a node, so its controls can close the
 * drawer too: the drawer owns its open state, and a control that navigates or
 * changes what the page shows should not leave the panel covering the result.
 */

export type NavDrawerItem = {
  label: ReactNode
  href: string
  /** The page you are on: ruled under in ink, and `aria-current="page"`. */
  active?: boolean
  /** Opens in a new tab via a plain anchor (bypasses LinkComponent). */
  external?: boolean
  /** Optional trailing pill (e.g. an "Alpha" tag). */
  badge?: ReactNode
}

/** A section of the drawer's index: one chapter of the home page's Contents. */
export type NavDrawerCategory = Omit<ContentsChapterProps, 'onFollow'>

type NavDrawerProps = {
  /** Brand lockup shown top-left of the panel (the Union bar's mark). */
  brand: ReactNode
  /** Primary nav links, rows under the index. */
  navItems: NavDrawerItem[]
  /** Optional index sections (the SRD's chapters), rendered above navItems. */
  categories?: NavDrawerCategory[]
  /** Optional search slot (SRD combobox), rendered under the brand row. */
  search?: ReactNode
  /**
   * Optional app-owned controls above the index (the app's Games list and
   * sign-in). Handed `close` so a control can dismiss the drawer when it is
   * used.
   */
  extra?: (close: () => void) => ReactNode
  /** Link component for internal items. Defaults to a plain anchor; the app passes SiteLink. */
  LinkComponent?: ElementType
}

// The full-screen layer the panel sits in, against its right edge.
const VIEWPORT = {
  display: 'flex',
  inset: 0,
  justifyContent: 'flex-end',
  position: 'fixed',
  zIndex: layer.overlay,
} satisfies CSSProperties

// The hamburger. Its padding and ink are on `.su-nav-drawer__trigger`, which
// the Union bar's phone cluster resizes (`styles/partials/shell.css`).
const TRIGGER = { ...TRANSITION_COLORS, borderRadius: radius.card } satisfies CSSProperties

// The panel. Its width is on `.su-nav-drawer__panel`.
const PANEL = {
  backgroundColor: color.paper,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  maxWidth: '85vw',
  padding: space[16],
} satisfies CSSProperties

const BRAND_ROW = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: space[16],
} satisfies CSSProperties

// The blocks under the search, the space between blocks apart (ruleset §4.4).
const BODY = {
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  gap: space[24],
  overflowY: 'auto',
} satisfies CSSProperties

export function NavDrawer({
  brand,
  navItems,
  categories,
  search,
  extra,
  LinkComponent = 'a',
}: NavDrawerProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="right">
      <Drawer.Trigger
        render={
          <Button
            variant="quiet"
            size="iconOnly"
            aria-label={compositionsCopy('openMenu')}
            className="su-nav-drawer__trigger"
            style={TRIGGER}
          >
            <Menu size={iconSize.full} aria-hidden="true" />
          </Button>
        }
      />

      <Drawer.Portal>
        <Drawer.Backdrop className="su-backdrop" />
        <Drawer.Viewport style={VIEWPORT}>
          <Drawer.Popup className="su-drawer su-nav-drawer__panel" style={PANEL}>
            <Drawer.Title className="su-sr-only">{compositionsCopy('navigationMenu')}</Drawer.Title>

            {/* Brand row: lockup | Close */}
            <div style={BRAND_ROW}>
              {brand}
              <Drawer.Close render={<CloseButton label={compositionsCopy('closeMenu')} />} />
            </div>

            {search && <div className="su-nav-drawer__search">{search}</div>}

            <div style={BODY}>
              {extra && <div className="su-nav-drawer-extra">{extra(close)}</div>}

              {/* The index (SRD): the home page's Contents, one tap each. Its
                  anchors are the drawer's own, so the home page's stay unique. */}
              {categories?.map((cat) => (
                <ContentsChapter key={cat.id} {...cat} id={`menu-${cat.id}`} onFollow={close} />
              ))}

              {/* The site's pages: rows of the same index. */}
              <ul className="su-contents__rows">
                {navItems.map((item) => {
                  // External items render a plain anchor in a new tab; internal
                  // ones route through LinkComponent. One element either way.
                  const Link = item.external ? 'a' : LinkComponent
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn('su-contents__row su-nav-drawer__link', FOCUS_RING)}
                        onClick={close}
                        {...(item.external
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : { 'aria-current': item.active ? ('page' as const) : undefined })}
                      >
                        <span>{item.label}</span>
                        {item.badge}
                        {item.external && (
                          <ExternalLink size={iconSize.compact} aria-hidden="true" />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
