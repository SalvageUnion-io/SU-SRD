/*
 * Ported from packages/component-lib/src/components/dashboard/DashboardCanvas.stories.tsx.
 * The story's resizable frame is fixed here — a card cannot be dragged, and the
 * letterboxing is visible at a fixed size anyway.
 */
import { DashboardCanvas } from 'component-lib'
import { Caption } from '../preview-lib/harness'

/**
 * The scale-to-fit dark shell that owns the `.pc-root` token scope. It renders a
 * 1280×800 HUD and letterboxes it onto the warm-paper ground; below the width
 * floor it drops to a reflow message instead. A bare placeholder stands in for
 * the store-wired grid, which lives in ITUN.
 */
export function ScaleToFit() {
  return (
    <div className="flex flex-col gap-3">
      <Caption>scale-to-fit HUD canvas (1280×800), letterboxed</Caption>
      <div style={{ height: 520, overflow: 'hidden', border: '1px solid #ccc' }}>
        <DashboardCanvas>
          <div className="pc-placeholder">
            <span
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'Barlow, sans-serif',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-ink-50)',
              }}
            >
              Dashboard grid · rail / primary / wheel / display
            </span>
          </div>
        </DashboardCanvas>
      </div>
    </div>
  )
}
