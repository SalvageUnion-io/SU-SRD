/**
 * DashboardCanvas — the fixed 1280×800 design canvas, scaled to fit its host with
 * a single `transform: scale(...)`, letterboxed, never scrolling (proposed
 * ADR-020). It scales linearly to fill the available space: the host is sized to
 * the viewport height below its own top offset (nothing on the ancestor chain
 * establishes a height, so `h-full` alone would collapse to the canvas's fixed
 * 800px layout box and leave dead space below), then the canvas grows uniformly
 * to fill whichever axis binds first. Below the width floor the fixed canvas is
 * abandoned for a stacked fallback (Phase 1 renders a placeholder message there;
 * the real phone reflow is a later phase).
 *
 * The dashboard layout shell — promoted out of ITUN as a legacy-tier component.
 * It owns the `.pc-root` dark-world token scope (see DashboardCanvas.css) that
 * every dashboard surface inherits; the grid regions and instruments remain in
 * ITUN and fill `children`.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import './DashboardCanvas.css'
// The shared instrument stylesheet (all `.pc-*` surfaces) lives here so the app
// holds no bespoke dashboard CSS; loading it with the canvas covers every
// dashboard surface rendered inside `.pc-root`.
import './instruments.css'

const CANVAS_W = 1280
const CANVAS_H = 800
// Width floor for the landscape HUD: below this the viewport is treated as the
// wrong form factor (phone) and the stacked fallback replaces the canvas.
const MIN_SCALE = 0.62
// Uniform upscale cap — generous enough to fill a 4K display's height while
// still guarding against an absurdly large render on giant panels (beyond which
// the dark ground letterboxes, preserving the HUD look).
const MAX_SCALE = 2.6

export function DashboardCanvas({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [reflow, setReflow] = useState(false)
  // Explicit viewport-anchored height: the host fills from its top offset down
  // to the viewport bottom so the scale math sees the true available space (and
  // the dark ground fills it) rather than the collapsed canvas layout box.
  const [hostH, setHostH] = useState<number | undefined>(undefined)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const compute = () => {
      const top = host.getBoundingClientRect().top
      const availH = Math.max(0, window.innerHeight - top)
      setHostH(availH)
      const w = host.clientWidth
      if (!w || !availH) return
      const rawW = w / CANVAS_W
      const rawH = availH / CANVAS_H
      // Reflow is a "wrong form factor" (phone) signal — keyed to WIDTH only, as
      // it always effectively was before the host gained a real height. A short
      // but wide desktop window must NOT trip the phone fallback; it just scales
      // the HUD down to fit its height.
      setReflow(rawW < MIN_SCALE)
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
  }, [])

  return (
    <div
      ref={hostRef}
      className="pc-root flex w-full items-center justify-center overflow-hidden"
      style={{ background: 'var(--color-su-paper)', height: hostH }}
    >
      {reflow ? (
        <div className="pc-reflow">
          <p>
            The Dashboard is a landscape, single-screen HUD. This viewport is below its size floor —
            rotate to landscape or use a larger screen. (A dedicated phone layout is planned.)
          </p>
        </div>
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
