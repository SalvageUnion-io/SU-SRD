/**
 * SlotOverlay — what ⤢ on a Minor opens: that entity's Major controls, as a
 * modal over the display, without changing which entity holds the Major slot
 * (docs/architecture/dashboard-redesign.md D3).
 *
 * A `ModalShell` portalled into `container` — the display region — so it stays
 * inside the scaled canvas, where the Major's `.pc-*` styling lives in the
 * `.pc-root` scope. Base UI moves focus into it, keeps Tab inside it, closes it
 * on Escape (unless something inside it, the Major's own Take Damage prompt,
 * already took that Escape) and gives focus back to the ⤢ that opened it.
 */

import { Button, ModalShell } from 'component-lib'
import type { CSSProperties, ReactNode, RefObject } from 'react'

/** The title row and the Major, laid over the scrim that dims the display. */
const FRAME: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '10px',
}

const HEAD: CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px' }

const TITLE: CSSProperties = {
  margin: 0,
  flex: 1,
  fontFamily: 'var(--font-cond)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-caps-tight)',
  fontSize: 'var(--text-caption)',
  color: 'var(--color-paper)',
}

/** The Major keeps the height it has in the slot row. */
const BODY: CSSProperties = { height: '208px', flex: '0 0 auto' }

export function SlotOverlay({
  open,
  title,
  container,
  onClose,
  returnFocusTo,
  children,
}: {
  open: boolean
  title: string
  /** The positioned box the overlay covers: the display region. */
  container: RefObject<HTMLElement | null>
  onClose: () => void
  /** The ⤢ that opened the overlay; focus goes back to it on close. */
  returnFocusTo: HTMLElement | null
  children: ReactNode
}) {
  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={title}
      container={container}
      finalFocus={{ current: returnFocusTo }}
      bare
    >
      <div style={FRAME}>
        <div style={HEAD}>
          <h2 style={TITLE}>{title}</h2>
          <Button size="compact" onClick={onClose}>
            Close
          </Button>
        </div>
        <div style={BODY}>{children}</div>
      </div>
    </ModalShell>
  )
}
