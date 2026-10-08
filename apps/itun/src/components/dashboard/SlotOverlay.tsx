/**
 * SlotOverlay — what ⤢ on a Minor opens: that entity's Major controls, as a
 * modal over the display, without changing which entity holds the Major slot
 * (docs/architecture/dashboard-redesign.md D3).
 *
 * It renders inside the scaled canvas rather than through a portal, because
 * the Major's `.pc-*` styling lives in the canvas's `.pc-root` scope. That
 * makes it responsible for what a portalled dialog gets for free:
 *
 *  - it takes focus when it opens;
 *  - Tab and Shift+Tab stay inside it;
 *  - Escape closes it — unless something inside it (the Major's own Take
 *    Damage prompt) already took that Escape, which `defaultPrevented` says;
 *  - closing gives focus back to the ⤢ that opened it.
 */

import { Button } from 'component-lib'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'

const BACKDROP: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 5,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '10px',
  background: 'color-mix(in srgb, var(--color-ink-deep) 88%, transparent)',
  outline: 'none',
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

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function SlotOverlay({
  title,
  onClose,
  returnFocusTo,
  children,
}: {
  title: string
  onClose: () => void
  /** The ⤢ that opened the overlay; focus goes back to it on close. */
  returnFocusTo: HTMLElement | null
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // `preventScroll`: the canvas is a scaled, overflow-hidden box, and a plain
  // `focus()` scrolls it to bring the target into view, shifting the HUD.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    return () => returnFocusTo?.focus({ preventScroll: true })
  }, [returnFocusTo])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      if (e.defaultPrevented) return
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const focusables = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={BACKDROP}
      onKeyDown={onKeyDown}
    >
      <div style={HEAD}>
        <h2 id={titleId} style={TITLE}>
          {title}
        </h2>
        <Button size="compact" onClick={onClose}>
          Close
        </Button>
      </div>
      <div style={BODY}>{children}</div>
    </div>
  )
}
