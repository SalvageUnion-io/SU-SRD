import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { color, space } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { buttonVariants } from '../chrome/buttonVariants'

type EntityDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible dialog name (screen-reader only — the card carries the visible title). */
  title: string
  children: ReactNode
}

/** Visually hidden, still announced — Tailwind's `sr-only`. */
const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
} satisfies CSSProperties

/** Centred in the viewport, as tall as its card, at most 72rem wide. */
const popupStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  margin: 'auto',
  height: 'fit-content',
  width: '100%',
  maxWidth: '72rem',
  backgroundColor: 'transparent',
  paddingLeft: space[12],
  paddingRight: space[12],
  outlineStyle: 'none',
} satisfies CSSProperties

/**
 * Tailwind's `shadow-lg` tint, carried verbatim: neutral black at 10%. There is
 * no shadow token ladder to move it onto, and a warm-ink substitute would
 * re-tone the stamp's shadow, so it stays one literal, exempted on its line.
 */
const shadowTint = 'rgb(0 0 0 / 0.1)' // design-tokens-ignore: Tailwind's shadow-lg tint, ported verbatim

/**
 * The close stamp's static half. Its background (ink, ink-2 on hover) is
 * `.su-detail-dialog__close`, since it has a hover.
 *
 * The shadow is inline on purpose: the `shadow-lg` utility it replaces sat in
 * Tailwind's `utilities` layer, above `.su-focus-ring:focus-visible`, so the
 * stamp always wore this shadow — and an inline value keeps exactly that.
 */
const closeStyle = {
  position: 'absolute',
  top: `-${space[8]}`,
  right: `-${space[8]}`,
  zIndex: 60,
  borderWidth: '2px',
  borderColor: color.paper,
  color: color.paper,
  boxShadow: `0 10px 15px -3px ${shadowTint}, 0 4px 6px -4px ${shadowTint}`,
} satisfies CSSProperties

const scrollStyle = {
  maxHeight: 'calc(100vh - 4rem)',
  overflowY: 'auto',
  paddingTop: space[12],
} satisfies CSSProperties

/**
 * `EntityDetailDialog` — the shared detail-modal chrome: backdrop, the
 * kitty-cornered SRD black-stamp close button, and the scroll wrapper a full
 * entity card needs. It holds NO card of its own, so both the entity path
 * (`useDetailModal`) and the pattern path (a chassis card's pattern rows) put
 * the same window around whatever they render.
 */
export function EntityDetailDialog({
  open,
  onOpenChange,
  title,
  children,
}: EntityDetailDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="su-backdrop" />
        <Dialog.Popup style={popupStyle}>
          {/* Overflow lives on the inner scroll wrapper so the close button
              (a sibling) isn't clipped by it. The scroll wrapper's pt-3 leaves
              room for the floating callout row, which straddles ~8px above the
              card's top edge — without it, overflow-y-auto clips the callout.
              The SRD black-stamp square button is kitty-cornered, straddling the
              card's top-right corner. */}
          <div style={{ position: 'relative' }}>
            {/* The SRD black stamp is not a Button VARIANT (paper hairline on
                ink, going ink-2 on hover), but its geometry, focus ring and
                disabled treatment are the shared icon rung's — so it composes
                `buttonVariants` and re-skins only the colours. */}
            <Dialog.Close
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'iconOnly' }),
                'su-detail-dialog__close'
              )}
              style={closeStyle}
            >
              <X style={{ width: space[20], height: space[20] }} aria-hidden="true" />
              <span style={srOnly}>Close</span>
            </Dialog.Close>
            <div style={scrollStyle}>
              <Dialog.Title style={srOnly}>{title}</Dialog.Title>
              <Dialog.Description style={srOnly}>Entity display details</Dialog.Description>
              {children}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
