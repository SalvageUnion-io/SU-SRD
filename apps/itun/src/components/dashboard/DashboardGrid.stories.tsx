import { Caption } from 'component-lib/stories/harness'
// The components import no CSS; the app (or story) loads the bundle.
import '../../styles/dashboard.css'
import { DashboardCanvas } from './DashboardCanvas'
import { DashboardGrid } from './DashboardGrid'

export default { title: 'Compositions/Dashboard/Grid' }

/**
 * The three-region scaffold (rail / primary / display) inside the scaled
 * canvas. Slots stand in for the store-wired instruments (RailBar, the slot
 * row, DisplayPanel). `data-mount="mech"` tints the rail green.
 */
export const Default = () => (
  <div className="flex flex-col gap-3">
    <Caption>Three-region layout: rail (top), the slot row (mid), display (bottom).</Caption>
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
          primary={<div className="pc-placeholder">Slot row · Major + two Minors</div>}
          display={<div className="pc-fill">Display · Actions / Tables / SRD</div>}
        />
      </DashboardCanvas>
    </div>
  </div>
)
