import { Drawer } from '@base-ui/react/drawer'
import { Menu, X } from 'lucide-react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useState } from 'react'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import { cn } from '../../utils/cn'
import { Badge } from '../chrome/Badge'
import { buttonVariants } from '../chrome/buttonVariants'
import { FOCUS_RING } from '../chrome/interaction'

/**
 * NavDrawer — the shared hamburger + slide-in mobile nav drawer (unifies the
 * SRD site drawer and the ITUN builder drawer). One Base UI `Drawer`: a
 * hamburger trigger, the shared `.su-backdrop` scrim, and a right-side panel
 * that slides in (`.su-drawer`) and can be swiped back out.
 *
 * Content is fully driven by props: a `brand` lockup, primary `navItems`
 * (rendered as the shared ghost `buttonVariants` buttons; the page you are on is
 * the inverse ink plate, never rust — ruleset §3.1), optional `categories` + `search` slot for the
 * SRD's richer drawer, and an optional `extra` slot for app-owned controls
 * (ITUN's Games list and sign-in). Router-agnostic: internal items render
 * through the injected `LinkComponent` (defaults to a plain anchor), external
 * ones as `<a target=_blank>`. Every item closes the drawer on tap.
 *
 * `extra` is a render function, not a node, so its controls can close the
 * drawer too: the drawer owns its open state, and a control that navigates or
 * changes what the page shows should not leave the panel covering the result.
 *
 * `footItems` are quiet links pinned to the drawer's foot, under a hairline —
 * the pages a reader looks for rarely (ITUN's About and Changelog, issue 1255).
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
   * Optional app-owned controls above the nav links (ITUN's Games list and
   * sign-in), ruled off from them. Handed `close` so a control can dismiss the
   * drawer when it is used.
   */
  extra?: (close: () => void) => ReactNode
  /** Quiet links at the drawer's foot (About, Changelog). */
  footItems?: NavDrawerItem[]
  /** Link component for internal items. Defaults to a plain anchor; ITUN passes AppLink. */
  LinkComponent?: ElementType
  /** Extra classes on the hamburger trigger (e.g. tint for a dark header). */
  triggerClassName?: string
  /** Panel width class. Without one the panel is full-width; ITUN uses a narrower drawer. */
  panelClassName?: string
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

// The drawer's foot: quiet links under a hairline, pinned to the bottom.
const FOOT = {
  borderTopColor: color.wkFaint,
  borderTopStyle: 'solid',
  borderTopWidth: borderWidth.hairline,
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[16],
  marginTop: space[12],
  paddingTop: space[12],
} satisfies CSSProperties

const FOOT_LINK = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.caption,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
} satisfies CSSProperties

// The full-screen layer the panel sits in, against its right edge.
const VIEWPORT = {
  display: 'flex',
  inset: 0,
  justifyContent: 'flex-end',
  position: 'fixed',
  zIndex: 50,
} satisfies CSSProperties

/** Tailwind's `transition-colors`, ported verbatim (minus its `--tw-gradient-*` stops). */
const TRANSITION_COLORS = {
  transitionDuration: '150ms',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
} satisfies CSSProperties

// The hamburger. Its padding and ink are on `.su-nav-drawer__trigger` instead,
// because `triggerClassName` overrides them (ITUN passes `p-1.5`).
const TRIGGER = { ...TRANSITION_COLORS, borderRadius: radius.panel } satisfies CSSProperties

// The panel. Its width is on `.su-nav-drawer__panel` instead, because
// `panelClassName` overrides it (ITUN passes `w-72`).
const PANEL = {
  backgroundColor: color.paper,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  maxWidth: '85vw',
  padding: space[16],
} satisfies CSSProperties

/** Visually hidden, still read (Tailwind's `sr-only`). */
const SR_ONLY = {
  borderWidth: 0,
  clip: 'rect(0, 0, 0, 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} satisfies CSSProperties

const BRAND_ROW = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: space[16],
} satisfies CSSProperties

// Its fill and ink change on hover, so those are on `.su-nav-drawer__close`.
const CLOSE = {
  ...TRANSITION_COLORS,
  alignItems: 'center',
  borderRadius: radius.panel,
  display: 'flex',
  justifyContent: 'center',
  padding: space[4],
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
  footItems,
  LinkComponent = 'a',
  triggerClassName,
  panelClassName,
}: NavDrawerProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="right">
      <Drawer.Trigger
        render={
          <button
            type="button"
            aria-label="Open menu"
            className={cn('su-nav-drawer__trigger', FOCUS_RING, triggerClassName)}
            style={TRIGGER}
          >
            <Menu size={24} aria-hidden="true" />
          </button>
        }
      />

      <Drawer.Portal>
        <Drawer.Backdrop className="su-backdrop" />
        <Drawer.Viewport style={VIEWPORT}>
          <Drawer.Popup
            className={cn('su-drawer su-nav-drawer__panel', panelClassName)}
            style={PANEL}
          >
            <Drawer.Title style={SR_ONLY}>Navigation Menu</Drawer.Title>

            {/* Brand row: lockup | Close */}
            <div style={BRAND_ROW}>
              {brand}
              <Drawer.Close
                render={
                  <button
                    type="button"
                    aria-label="Close menu"
                    className={cn('su-nav-drawer__close', FOCUS_RING)}
                    style={CLOSE}
                  >
                    <X size={22} aria-hidden="true" />
                  </button>
                }
              />
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
                          href={schema.href || `/schema/${schema.id}/`}
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
                  const Link = item.external ? 'a' : LinkComponent
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        buttonVariants({ variant: 'ghost' }),
                        'su-nav-drawer__link',
                        item.active && 'su-btn--here'
                      )}
                      onClick={close}
                      {...(item.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : { 'aria-current': item.active ? ('page' as const) : undefined })}
                    >
                      {item.label}
                      {item.badge}
                    </Link>
                  )
                })}
              </div>
            </div>

            {footItems && footItems.length > 0 && (
              <nav aria-label="More" style={FOOT}>
                {footItems.map((item) => {
                  const Link = item.external ? 'a' : LinkComponent
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={FOCUS_RING}
                      style={FOOT_LINK}
                      onClick={close}
                      {...(item.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : { 'aria-current': item.active ? ('page' as const) : undefined })}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            )}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
