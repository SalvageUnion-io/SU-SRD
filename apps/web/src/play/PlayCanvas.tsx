/**
 * PlayCanvas — the 1280×800 design canvas, scaled to fit its host with a
 * single `transform: scale(...)`, never scrolling (ADR-038 §9). It scales
 * linearly with the available space: the host is sized to the viewport height
 * below its own top offset (nothing on the ancestor chain establishes a
 * height, so `height: 100%` alone would collapse to the canvas's layout box
 * and leave dead space below), the scale is whichever axis binds first, and
 * the canvas then widens (or lengthens) in its own units to fill the other
 * axis too. So the Play bar and foot run edge to edge, as every page's band
 * and foot do, and no page ground letterboxes the screen.
 *
 * **Below its design size on either axis it renders the phone form instead**
 * (`phone`, ADR-045 decision 1; play.md §11): the canvas
 * never scales down, because its smallest text is already the 11px floor
 * (`isPhoneForm`). So a phone, a tablet, a mid-size window or one under 800px
 * tall gets the phone form, and so does browser zoom: fitting the canvas
 * would cancel zoom, so the floor rises with it (`pageZoom`, ADR-045 §7) and
 * a zoomed reader reaches the phone form, whose type grows, sooner. The phone form fits the screen too: its host is
 * exactly the height below its top, and `phone` scrolls inside itself (only
 * the open tab's list scrolls, ADR-051 §10).
 *
 * It owns the `.su-play-root` scope (`styles/play/canvas.css`) that every
 * Play surface inherits, and paints the page ground the columns sit on, as
 * the sheets' and the Play hub's pages do. It
 * imports no stylesheet: `PlayFrame` loads Play's.
 *
 * Its host, in either form, is the page's one `<main>` landmark: no Play
 * route wraps one (`__root.tsx` leaves it to each route), and everything on a
 * Play screen, the Play bar included, is the screen's content.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { CanvasFit } from './playCanvas.model'
import {
  CANVAS_H,
  CANVAS_W,
  canvasFit,
  isPhoneForm,
  layoutWidth,
  pageZoom,
} from './playCanvas.model'

/** The canvas form's host: the page ground, the canvas centred in it. */
const HOST = {
  alignItems: 'center',
  background: 'var(--color-wk-bg)',
  display: 'flex',
  justifyContent: 'center',
  overflow: 'hidden',
  width: '100%',
} satisfies CSSProperties

/** The phone form's host: it never scrolls, its content does. */
const PHONE_HOST = {
  background: 'var(--color-wk-bg)',
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
  const [fit, setFit] = useState<CanvasFit>({ scale: 1, width: CANVAS_W, height: CANVAS_H })
  const [phoneForm, setPhoneForm] = useState(false)
  // Explicit viewport-anchored height: the host fills from its top offset down
  // to the viewport bottom so the scale math sees the true available space (and
  // the ground fills it) rather than the collapsed canvas layout box.
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
      const zoom = pageZoom({
        devicePixelRatio: window.devicePixelRatio,
        // In a frame, `outerWidth` is the top window's: no reading.
        outerWidth: window.top === window ? window.outerWidth : 0,
        viewportWidth: layoutWidth(document.documentElement.clientWidth, window.innerWidth),
      })
      setPhoneForm(isPhoneForm(w, availH, zoom))
      // Uniform scale by whichever axis binds first, the canvas widened to
      // fill the other. It only draws at 1 or more: below that the phone
      // form is up.
      setFit(canvasFit(w, availH))
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
        className="su-play-root su-play-root--phone"
        style={{ ...PHONE_HOST, height: hostH }}
      >
        {phone}
      </main>
    )
  }

  return (
    // Centred, so any rounding left over splits evenly on both sides.
    <main ref={hostRef} className="su-play-root" style={{ ...HOST, height: hostH }}>
      <div
        className="su-play-canvas"
        style={{
          flexShrink: 0,
          height: fit.height,
          transform: `scale(${fit.scale})`,
          transformOrigin: 'center center',
          width: fit.width,
        }}
      >
        {children}
      </div>
    </main>
  )
}
