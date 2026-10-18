/**
 * PlayCanvas — the fixed 1280×800 design canvas, scaled to fit its host with
 * a single `transform: scale(...)`, letterboxed, never scrolling (ADR-038
 * §9). It scales linearly to fill the available space: the host is sized to
 * the viewport height below its own top offset (nothing on the ancestor chain
 * establishes a height, so `height: 100%` alone would collapse to the canvas's
 * fixed 800px layout box and leave dead space below), then the canvas grows
 * uniformly to fill whichever axis binds first.
 *
 * **Below the floor on either axis it renders the phone form instead**
 * (`phone`, ADR-045; play.md §11): a portrait phone, a landscape phone (whose
 * height would draw the canvas near 0.49), a window under about 496px tall,
 * or browser zoom. Fitting the canvas would cancel zoom, so the floor rises
 * with it (`pageZoom`, ADR-045 §7) and a zoomed reader reaches the phone form,
 * whose type grows, sooner. The phone form fits the screen too: its host is
 * exactly the height below its top, and `phone` scrolls inside itself (only
 * the open tab's list scrolls, ADR-051 §10).
 *
 * It owns the `.su-dash-root` scope (`styles/cantina/dashboard/`) that every
 * Play surface inherits, and paints the dark ground the columns sit on. It
 * imports no stylesheet: `PlayFrame` loads Play's.
 *
 * Its host, in either form, is the page's one `<main>` landmark: no Play
 * route wraps one (`__root.tsx` leaves it to each route), and everything on a
 * Play screen, the Play bar included, is the screen's content.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { CANVAS_H, CANVAS_W, isPhoneForm, layoutWidth, pageZoom } from './playCanvas.model'

// Uniform upscale cap — generous enough to fill a 4K display's height while
// still guarding against an absurdly large render on giant panels (beyond which
// the ground letterboxes).
const MAX_SCALE = 2.6

/** The canvas form's host: the dark ground, the canvas centred in it. */
const HOST = {
  alignItems: 'center',
  background: 'var(--color-ink-deep)',
  display: 'flex',
  justifyContent: 'center',
  overflow: 'hidden',
  width: '100%',
} satisfies CSSProperties

/** The phone form's host: it never scrolls, its content does. */
const PHONE_HOST = {
  background: 'var(--color-band-cream)',
  overflow: 'hidden',
  width: '100%',
} satisfies CSSProperties

type PlayCanvasProps = {
  /** The canvas form: the fixed 1280×800 grid. */
  children: ReactNode
  /** The phone form, rendered instead of the canvas below the floor. */
  phone: ReactNode
}

export function PlayCanvas({ children, phone }: PlayCanvasProps) {
  const hostRef = useRef<HTMLElement>(null)
  const [scale, setScale] = useState(1)
  const [phoneForm, setPhoneForm] = useState(false)
  // Explicit viewport-anchored height: the host fills from its top offset down
  // to the viewport bottom so the scale math sees the true available space (and
  // the dark ground fills it) rather than the collapsed canvas layout box.
  const [hostH, setHostH] = useState<number | undefined>(undefined)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `phoneForm` is read by no line here, but each form renders its own host element, so the observer must re-bind to the new one when the form flips.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const compute = () => {
      // The host's offset from the top of the PAGE, not the viewport, so a
      // host scrolled up never reads as a taller window.
      const top = host.getBoundingClientRect().top + window.scrollY
      const availH = Math.max(0, window.innerHeight - top)
      setHostH(availH)
      const w = host.clientWidth
      if (!w || !availH) return
      const rawW = w / CANVAS_W
      const rawH = availH / CANVAS_H
      const zoom = pageZoom({
        devicePixelRatio: window.devicePixelRatio,
        // In a frame, `outerWidth` is the top window's: no reading.
        outerWidth: window.top === window ? window.outerWidth : 0,
        viewportWidth: layoutWidth(document.documentElement.clientWidth, window.innerWidth),
      })
      setPhoneForm(isPhoneForm(w, availH, zoom))
      // Uniform scale that fits whichever axis binds first (never clipping),
      // capped so it can fill space without ballooning on giant panels.
      setScale(Math.min(MAX_SCALE, Math.min(rawW, rawH)))
    }
    compute()
    // ResizeObserver catches host/layout changes; the window resize listener
    // catches viewport-height changes (which don't resize the host on their own
    // once its height is pinned). ResizeObserver is absent in some test/SSR
    // environments — the listener alone still sizes the canvas there.
    window.addEventListener('resize', compute)
    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', compute)
    }
    const ro = new ResizeObserver(compute)
    ro.observe(host)
    return () => {
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
  }, [phoneForm])

  if (phoneForm) {
    return (
      <main
        ref={hostRef}
        className="su-dash-root su-dash-phone"
        style={{ ...PHONE_HOST, height: hostH }}
      >
        {phone}
      </main>
    )
  }

  return (
    // Centred, so a downscaled canvas letterboxes evenly above and below.
    <main ref={hostRef} className="su-dash-root" style={{ ...HOST, height: hostH }}>
      <div
        className="su-dash-canvas"
        style={{ flexShrink: 0, transform: `scale(${scale})`, transformOrigin: 'center center' }}
      >
        {children}
      </div>
    </main>
  )
}
