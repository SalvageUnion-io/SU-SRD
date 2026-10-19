import { Drawer } from '@base-ui/react/drawer'
import { Search } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { color, font, fontSize, layer, radius, space, weight } from '../design/tokens'
import { POPUP_SURFACE } from './atoms/popupSurface'
import { buttonVariants, CloseButton, cn } from './index'

type MobileSearchDialogProps = {
  /**
   * The search UI hosted inside the sheet (e.g. srd's `SearchIsland`). It only
   * mounts while the sheet is open, so its data load stays deferred to first
   * open. The caller owns any content-specific styling (input width, etc.).
   */
  children: ReactNode
}

// The full-screen layer the sheet sits in, against its top edge.
const VIEWPORT = {
  display: 'flex',
  flexDirection: 'column',
  inset: 0,
  position: 'fixed',
  zIndex: layer.overlay,
} satisfies CSSProperties

/** The sheet: the title row over the hosted search. `.su-drawer` slides it. */
const POPUP = {
  ...POPUP_SURFACE.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  padding: space[16],
} satisfies CSSProperties

const TITLE_ROW = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
} satisfies CSSProperties

const TITLE = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.sm,
  fontWeight: weight.bold,
  lineHeight: 'calc(1.25 / 0.875)',
  textTransform: 'uppercase',
} satisfies CSSProperties

// The trigger over the shared icon rung. Its ground is the rung's
// (`.su-btn--ghost`), except its hover, which is `.su-mobile-search__trigger`
// in pages.css; it takes the Union bar's control height
// (`--su-union-bar-control`). Its foreground is the bar's: paper, or the ink of
// a page band that recolours it.
const TRIGGER = {
  borderColor: 'transparent',
  borderRadius: radius.panel,
  color: 'var(--su-bar-fg)',
} satisfies CSSProperties

const iconButtonClass = buttonVariants({ variant: 'ghost', size: 'iconOnly' })

/**
 * Persistent search trigger + full-screen sheet for a mobile top nav bar. On
 * phones search is the primary action, so it lives directly in the bar (not
 * buried in the hamburger drawer). Tapping the magnifier opens a top sheet that
 * hosts arbitrary search `children` (srd passes its `SearchIsland`).
 *
 * Content-agnostic shell: it owns the trigger, the sheet chrome (title + close),
 * focus trapping, and the slide (`.su-drawer`; it swipes back up to close); the
 * caller injects the search UI. Base UI's Drawer only mounts the sheet (and its
 * children) while open, so it adds no cost to the closed state.
 */
export function MobileSearchDialog({ children }: MobileSearchDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="up">
      <Drawer.Trigger
        render={
          // 44px meets the WCAG 2.5.5 minimum touch-target size, the one
          // documented override on the shared icon rung. `ghost` + a
          // transparent border keeps the bar's flat look while the rung
          // supplies the focus ring this trigger simply did not have.
          <button
            type="button"
            className={cn(iconButtonClass, 'su-mobile-search__trigger')}
            style={TRIGGER}
            aria-label="Search the Reference"
          >
            <Search aria-hidden="true" size={22} strokeWidth={2.5} />
          </button>
        }
      />

      <Drawer.Portal>
        <Drawer.Backdrop className="su-backdrop" />
        <Drawer.Viewport style={VIEWPORT}>
          <Drawer.Popup className="su-drawer" style={POPUP}>
            <div style={TITLE_ROW}>
              <Drawer.Title style={TITLE}>Search</Drawer.Title>
              <Drawer.Close render={<CloseButton label="Close search" />} />
            </div>
            {children}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
