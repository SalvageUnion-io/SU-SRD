import { Drawer } from '@base-ui/react/drawer'
import { Menu } from 'lucide-react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useState } from 'react'
import { srdSchemaPath } from 'salvageunion-reference'
import { borderWidth, color, iconSize, layer, radius, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { CloseButton } from '../atoms/CloseButton'
import { FOCUS_RING } from '../atoms/interaction'
import { TRANSITION_COLORS } from '../atoms/transition'

/**
 * NavDrawer — the hamburger + slide-in mobile nav drawer under the Union bar's
 * one phone drawer (`unionBar/UnionDrawer.tsx`). One Base UI `Drawer`: a
 * hamburger trigger, the shared `.su-backdrop` scrim, and a right-side panel
 * that slides in (`.su-drawer`) and can be swiped back out.
 *
 * Content is fully driven by props: a `brand` lockup, primary `navItems`
 * (rendered as the shared ghost `buttonVariants` buttons; the page you are on is
 * the inverse ink plate, never rust — ruleset §3.1), optional `categories` + `search` slot for the
 * SRD's richer drawer, and an optional `extra` slot for app-owned controls
 * (The app's Games list and sign-in). Router-agnostic: internal items render
 * through the injected `LinkComponent` (defaults to a plain anchor), external
 * ones as `<a target=_blank>`. Every item closes the drawer on tap.
 *
 * `extra` is a render function, not a node, so its controls can close the
 * drawer too: the drawer owns its open state, and a control that navigates or
 * changes what the page shows should not leave the panel covering the result.
 */

export type NavDrawerItem = {
  label: ReactNode
  href: string
  /** The page you are on: an ink plate and `aria-current="page"`. */
  active?: boolean
  /** Opens in a new tab via a plain anchor (bypasses LinkComponent). */
  external?: boolean
  /** Optional trailing pill (e.g. an "Alpha" tag). */
  badge?: ReactNode
}

type SchemaLink = {
  id: string
  displayName: string
  href?: string
  /** How many entries the link opens onto, shown at the row's end. */
  count?: number
}

/**
 * A section of the drawer's index: an ink section stamp over compact rows
 * (board 08, the SRD's chapters with their counts), the same index the SRD's
 * home page prints.
 */
export type NavDrawerCategory = {
  label: string
  schemas: SchemaLink[]
}

type NavDrawerProps = {
  /** Brand lockup shown top-left of the panel (e.g. the two-tone wordmark tag). */
  brand: ReactNode
  /** Primary nav links, rendered as buttonVariants buttons. */
  navItems: NavDrawerItem[]
  /** Optional index sections (the SRD's chapters), rendered above navItems. */
  categories?: NavDrawerCategory[]
  /** Optional search slot (SRD combobox), rendered under the brand row. */
  search?: ReactNode
  /**
   * Optional app-owned controls above the nav links (The app's Games list and
   * sign-in), ruled off from them. Handed `close` so a control can dismiss the
   * drawer when it is used.
   */
  extra?: (close: () => void) => ReactNode
  /** Link component for internal items. Defaults to a plain anchor; the app passes SiteLink. */
  LinkComponent?: ElementType
}

// The rule between the app's `extra` controls and the nav links — the same
// faint hairline that divides the SRD's catalog from its links. Hidden by
// `.su-nav-drawer-extra:empty` when the app's controls render nothing (a
// signed-in player who is offline has neither Games nor a sign-in to offer), so
// the drawer never shows a rule under an empty box.
const EXTRA = {
  borderBottomColor: color.wkFaint,
  borderBottomStyle: 'solid',
  borderBottomWidth: borderWidth.hairline,
  marginBottom: space[8],
  paddingBottom: space[16],
} satisfies CSSProperties

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

const BODY = {
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  gap: space[8],
  overflowY: 'auto',
} satisfies CSSProperties

const NAV = { display: 'flex', flexDirection: 'column', gap: space[8] } satisfies CSSProperties

// Under the index, the nav links drop to the drawer's foot behind a rule.
const NAV_UNDER_INDEX = {
  ...NAV,
  borderTop: `${borderWidth.hairline} solid ${color.wkFaint}`,
  marginTop: 'auto',
  paddingTop: space[16],
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
            aria-label="Open menu"
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
            <Drawer.Title className="su-sr-only">Navigation menu</Drawer.Title>

            {/* Brand row: lockup | Close */}
            <div style={BRAND_ROW}>
              {brand}
              <Drawer.Close render={<CloseButton label="Close menu" />} />
            </div>

            {search && <div className="su-nav-drawer__search">{search}</div>}

            <div style={BODY}>
              {extra && (
                <div className="su-nav-drawer-extra" style={EXTRA}>
                  {extra(close)}
                </div>
              )}

              {/* The index (SRD): a section stamp over compact rows, each with
                  its count — the home page's chapters, one tap each. */}
              {categories?.map((cat) => (
                <section key={cat.label} className="su-nav-drawer__section">
                  <Badge shape="stamp" as="h2">
                    {cat.label}
                  </Badge>
                  <ul className="su-nav-drawer__rows">
                    {cat.schemas.map((schema) => (
                      <li key={schema.id}>
                        <a
                          href={schema.href || `${srdSchemaPath(schema.id)}/`}
                          className={cn('su-nav-drawer__row', FOCUS_RING)}
                          onClick={close}
                        >
                          <span>{schema.displayName}</span>
                          {schema.count != null && (
                            <span className="su-nav-drawer__count">{schema.count}</span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {/* Primary nav links */}
              <div style={categories && categories.length > 0 ? NAV_UNDER_INDEX : NAV}>
                {navItems.map((item) => {
                  // External items render a plain anchor in a new tab; internal
                  // ones route through LinkComponent. One element either way.
                  return (
                    <Button
                      key={item.href}
                      href={item.href}
                      linkAs={item.external ? 'a' : LinkComponent}
                      variant="ghost"
                      className={cn('su-nav-drawer__link', item.active && 'su-btn--here')}
                      onClick={close}
                      {...(item.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : { 'aria-current': item.active ? ('page' as const) : undefined })}
                    >
                      {item.label}
                      {item.badge}
                    </Button>
                  )
                })}
              </div>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
