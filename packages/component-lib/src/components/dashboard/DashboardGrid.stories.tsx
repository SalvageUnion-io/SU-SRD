import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { DashboardCanvas } from './DashboardCanvas'
import { DashboardGrid } from './DashboardGrid'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Compositions/Dashboard/Grid' }

/**
 * The four-region scaffold (rail / primary / wheel / display) inside the scaled
 * canvas. Slots stand in for the store-wired instruments (RailBar, Active Item
 * band, Dial, DisplayView). `data-mount='mech'` tints the rail green.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-3">
    <Caption>
      Four-region layout: rail (top), primary + wheel (mid), display + wheel (bottom).
    </Caption>
    <div style={{ height: 520, resize: 'both', overflow: 'hidden', border: '1px solid #ccc' }}>
      <DashboardCanvas>
        <DashboardGrid
          mount="mech"
          rail={
            <span
              style={{
                background: 'var(--color-sheet-mech-deep)',
                color: '#fff',
                fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif",
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontSize: 13,
                padding: '5px 9px 6px',
                borderRadius: 2,
              }}
            >
              Mech · Iron Mongrel
            </span>
          }
          primary={<div className="pc-placeholder">Active Item Band</div>}
          display={<div className="pc-fill">Display · Actions / Tables / SRD</div>}
          wheel={<div className="pc-placeholder">Momentum Wheel</div>}
        />
      </DashboardCanvas>
    </div>
  </div>
)
