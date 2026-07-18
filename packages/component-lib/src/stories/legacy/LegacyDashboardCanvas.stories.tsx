/**
 * Legacy "before" capture — ITUN Dashboard `DashboardCanvas` (the scaled shell).
 *
 * Reproduces the fixed 1280×800 design canvas from
 * apps/in-the-union-now/src/components/dashboard/DashboardCanvas.tsx VERBATIM —
 * the dark `pc-root` host (letterboxed, centered, never scrolling) that carries
 * the `pc-canvas` scaled by a single `transform: scale(...)`, and the
 * `pc-reflow` message shown below the width floor. The ResizeObserver scale math
 * is behavioural, not presentational, so the capture pins a fixed scale; the
 * canvas holds a bare `pc-grid` of placeholder surfaces (rail / primary / wheel
 * / display) so the letterboxing is visible. L1 reconciliation: freeze the
 * "before", do not refactor the raw markup.
 */

import type { Story } from '@ladle/react'
import { Caption } from '../_harness'
import './LegacyDashboardCanvas.css'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Dashboard Canvas' }

/** The grid of placeholder surfaces that lives inside the canvas (children). */
function CanvasGridPlaceholder() {
  return (
    <div className="pc-grid">
      <div className="pc-rail">
        <span className="pc-fill" style={{ height: 'auto', padding: 0 }}>
          Rail
        </span>
      </div>
      <div className="pc-primary">
        <div className="pc-placeholder">Active Item Band</div>
      </div>
      <div className="pc-wheel">
        <div className="pc-placeholder">Momentum Wheel</div>
      </div>
      <div className="pc-display">
        <div className="pc-fill">Display · Actions / Tables / SRD</div>
      </div>
    </div>
  )
}

export const Default: Story = () => (
  <div style={{ maxWidth: 720 }}>
    <Caption>
      DashboardCanvas — the fixed 1280×800 canvas letterboxed inside the dark `pc-root` host and
      shrunk by a single `transform: scale()`. Scale is pinned here (the live component computes it
      from the host size via ResizeObserver).
    </Caption>
    {/* Verbatim host: pc-root + centered flex + a fixed viewport-anchored height. */}
    <div
      className="pc-root flex w-full items-center justify-center overflow-hidden"
      style={{ background: 'var(--pc-ground)', height: 400 }}
    >
      <div
        className="pc-canvas shrink-0"
        style={{ transform: 'scale(0.44)', transformOrigin: 'center center' }}
      >
        <CanvasGridPlaceholder />
      </div>
    </div>
  </div>
)

export const Reflow: Story = () => (
  <div style={{ maxWidth: 720 }}>
    <Caption>
      DashboardCanvas below its width floor (MIN_SCALE) — the fixed canvas is abandoned for the
      `pc-reflow` "wrong form factor" message.
    </Caption>
    <div
      className="pc-root flex w-full items-center justify-center overflow-hidden"
      style={{ background: 'var(--pc-ground)', height: 300, width: 320 }}
    >
      <div className="pc-reflow">
        <p>
          The Dashboard is a landscape, single-screen HUD. This viewport is below its size floor —
          rotate to landscape or use a larger screen. (A dedicated phone layout is planned.)
        </p>
      </div>
    </div>
  </div>
)
