/* Ported from packages/component-lib/src/components/dashboard/DashboardGrid.stories.tsx. */
import { DashboardCanvas, DashboardGrid } from 'component-lib'
import { Caption } from '../preview-lib/harness'

function RailStamp({ label }: { label: string }) {
  return (
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
      {label}
    </span>
  )
}

/**
 * The four-region scaffold — rail (top), primary + wheel (mid), display + wheel
 * (bottom) — inside the scaled canvas. The slots stand in for the store-wired
 * instruments: RailBar, the Active Item band, the Dial, and DisplayPanel.
 * `data-mount` tints the rail.
 */
export function Regions() {
  return (
    <div className="flex flex-col gap-3">
      <Caption>four-region layout, mech mount</Caption>
      <div style={{ height: 520, overflow: 'hidden', border: '1px solid #ccc' }}>
        <DashboardCanvas>
          <DashboardGrid
            mount="mech"
            rail={<RailStamp label="Mech · Iron Mongrel" />}
            primary={<div className="pc-placeholder">Active Item Band</div>}
            display={<div className="pc-fill">Display · Actions / Tables / SRD</div>}
            wheel={<div className="pc-placeholder">Momentum Wheel</div>}
          />
        </DashboardCanvas>
      </div>
    </div>
  )
}
