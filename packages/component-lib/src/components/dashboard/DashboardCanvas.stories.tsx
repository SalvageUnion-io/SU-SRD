import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { DashboardCanvas } from './DashboardCanvas'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Dashboard Canvas' }

/**
 * The real promoted DashboardCanvas — the scale-to-fit dark shell that owns the
 * `.pc-root` token scope. Resize the frame to watch it letterbox and, below the
 * width floor, drop to the reflow message. A bare placeholder stands in for the
 * store-wired grid (which lives in ITUN).
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-3">
    <Caption>Scale-to-fit HUD canvas (1280×800), letterboxed on the dark ground.</Caption>
    <div style={{ height: 520, resize: 'both', overflow: 'hidden', border: '1px solid #ccc' }}>
      <DashboardCanvas>
        <div className="pc-canvas-placeholder">
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
              color: 'var(--pc-muted)',
            }}
          >
            Dashboard grid · rail / primary / wheel / display
          </span>
        </div>
      </DashboardCanvas>
    </div>
  </div>
)
