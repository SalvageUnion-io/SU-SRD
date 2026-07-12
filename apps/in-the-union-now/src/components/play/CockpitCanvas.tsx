/**
 * CockpitCanvas — the fixed 1280×800 design canvas, scaled to fit its host with
 * a single `transform: scale(...)`, letterboxed, never scrolling (proposed
 * ADR-020). Below the clamp floor the fixed canvas is abandoned for a stacked
 * fallback (Phase 1 renders a placeholder message there; the real phone reflow
 * is a later phase).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'

const CANVAS_W = 1280
const CANVAS_H = 800
const MIN_SCALE = 0.62
const MAX_SCALE = 1.3

export function CockpitCanvas({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [reflow, setReflow] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const compute = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (!w || !h) return
      const raw = Math.min(w / CANVAS_W, h / CANVAS_H)
      setReflow(raw < MIN_SCALE)
      setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, raw)))
    }
    compute()
    // ResizeObserver is absent in some test/SSR environments — fall back to
    // a window resize listener so the canvas still sizes (and never throws).
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', compute)
      return () => window.removeEventListener('resize', compute)
    }
    const ro = new ResizeObserver(compute)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={hostRef}
      className="pc-root flex h-full w-full items-center justify-center overflow-hidden"
      style={{ background: 'var(--pc-ground)' }}
    >
      {reflow ? (
        <div className="pc-reflow">
          <p>
            The Play Cockpit is a landscape, single-screen HUD. This viewport is below its size
            floor — rotate to landscape or use a larger screen. (A dedicated phone layout is
            planned.)
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
