/**
 * DashboardCanvas — the fixed 1280×800 design canvas, scaled to fit its host with
 * a single `transform: scale(...)`, letterboxed, never scrolling (ADR-038
 * §9). It scales linearly to fill the available space: the
 * host is sized to the viewport height below its own top offset (nothing on the
 * ancestor chain establishes a height, so `h-full` alone would collapse to the
 * canvas's fixed 800px layout box and leave dead space below), then the canvas
 * grows uniformly to fill whichever axis binds first.
 *
 * **Below the floor on either axis it renders the phone form instead**
 * (`phone`, ADR-044; docs/architecture/dashboard.md §7): a portrait phone, a
 * landscape phone (whose height would draw the canvas near 0.49), a window
 * under about 496px tall, or browser zoom deep enough to shrink the CSS
 * viewport. The phone form scrolls the page; the canvas never does. The
 * rotate-to-landscape notice it replaces is retired.
 *
 * The dashboard layout shell. It owns the `.pc-root` scope (see
 * DashboardCanvas.css) that every dashboard surface inherits, and paints the
 * dark ground the instruments sit on; the grid regions and instruments fill
 * `children`.
 *
 * Two optional props serve the Mediator Dashboard alone
 * (docs/architecture/mediator-dashboard.md Q4): `minScale` raises the width
 * floor (0.8 there; the player keeps 0.62), and `reflow` replaces the rotate
 * notice with a node of the caller's own, which the Mediator's surface uses to
 * stack its panels in one scrolling column so a Mediator on a phone keeps
 * everything. The host scrolls only while that node is showing.
 *
 * It imports NO stylesheet. The `.pc-*` rules live in ITUN's
 * `src/styles/dashboard.css`, which `Dashboard.tsx` (the route component)
 * imports, so the stylesheet loads with the dashboard route's chunk.
 */

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { CANVAS_H, CANVAS_W, isPhoneForm } from './dashboardForm'

// Uniform upscale cap — generous enough to fill a 4K display's height while
// still guarding against an absurdly large render on giant panels (beyond which
// the ground letterboxes, preserving the HUD look).
const MAX_SCALE = 2.6

/** The caller's own fallback below the floor: it fills the host and scrolls. */
const REFLOW_HOST: CSSProperties = {
  alignSelf: 'stretch',
  width: '100%',
  height: '100%',
  overflowY: 'auto',
}

type DashboardCanvasProps = {
  /** The canvas form: the fixed 1280×800 grid. */
  children: ReactNode
  /**
   * The phone form, rendered instead of the canvas below the floor. Without
   * one, the canvas scales down regardless (the not-found shell).
   */
  phone?: ReactNode
  /**
   * A caller's own floor as a scale, replacing the phone form's `isPhoneForm`
   * floor. The Mediator Dashboard sets 0.8.
   */
  minScale?: number
  /** What shows below `minScale` instead of the canvas: it fills the host and scrolls. */
  reflow?: ReactNode
}

export function DashboardCanvas({
  children,
  phone,
  minScale,
  reflow: reflowNode,
}: DashboardCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [reflow, setReflow] = useState(false)
  // Explicit viewport-anchored height: the host fills from its top offset down
  // to the viewport bottom so the scale math sees the true available space (and
  // the dark ground fills it) rather than the collapsed canvas layout box.
  const [hostH, setHostH] = useState<number | undefined>(undefined)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reflow` is read by no line here, but each form renders its own host element, so the observer must re-bind to the new one when the form flips.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const compute = () => {
      // The host's offset from the top of the PAGE, not the viewport: the
      // phone form scrolls, and a host scrolled up must not read as a taller
      // window (a landscape phone would flip to the canvas mid-scroll). The
      // canvas never scrolls, so there the two agree.
      const top = host.getBoundingClientRect().top + window.scrollY
      const availH = Math.max(0, window.innerHeight - top)
      setHostH(availH)
      const w = host.clientWidth
      if (!w || !availH) return
      const rawW = w / CANVAS_W
      const rawH = availH / CANVAS_H
      setReflow(minScale === undefined ? isPhoneForm(w, availH) : Math.min(rawW, rawH) < minScale)
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
  }, [reflow, minScale])

  if (reflow && phone !== undefined) {
    return (
      // The phone form: the page scrolls, so the host takes its content's
      // height (at least the screen's) rather than the viewport's.
      <div
        ref={hostRef}
        className="pc-root su-dash-phone"
        style={{ background: 'var(--color-band-cream)', minHeight: hostH, width: '100%' }}
      >
        {phone}
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      // Centred, so a downscaled canvas letterboxes evenly above and below.
      //
      // Top-aligning it (collecting the slack under the HUD instead) was tried
      // and reverted on the belief that it stopped the ground painting to the
      // bottom of the screen. That was a misreading: the pale band was the
      // DISPLAY panel, not bare page. Sampled pixels show the ground reaching
      // the viewport bottom either way, so the choice between the two is an
      // open styling question and not a defect.
      className="pc-root flex w-full items-center justify-center overflow-hidden"
      style={{ background: 'var(--color-ink-deep)', height: hostH }}
    >
      {reflow && reflowNode !== undefined ? (
        <div style={REFLOW_HOST}>{reflowNode}</div>
      ) : (
        <div
          className="pc-canvas shrink-0"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
