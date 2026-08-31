/*
 * Ported from packages/component-lib/src/components/dashboard/DialConfig.stories.tsx.
 * The story holds the row state the app's CockpitPrefs would persist; the cell
 * shows it settled. The stage is taller than the story's 320px so all six rows
 * fit — at 320 the last row is cut off.
 */
import { DialConfig } from 'component-lib'
import { Caption, InstrumentStage } from '../preview-lib/harness'

const ROWS = [
  { id: 'actions', label: 'Actions', hidden: false, locked: true },
  { id: 'tables', label: 'Tables', hidden: false },
  { id: 'mech', label: 'Mech', hidden: false },
  { id: 'pilot', label: 'Pilot', hidden: false },
  { id: 'crawler', label: 'Crawler', hidden: false },
]

/**
 * The ⚙ dial-config overlay: show/hide rows via the toggle, reorder with ▲▼.
 * "Actions" is locked visible, so its toggle is disabled and its label is
 * suffixed "(locked)".
 */
export function Overlay() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>dial configuration — reorderable show/hide list</Caption>
      <InstrumentStage width={280}>
        <div style={{ position: 'relative', height: 380 }}>
          <DialConfig rows={ROWS} onToggle={() => {}} onMove={() => {}} onClose={() => {}} />
        </div>
      </InstrumentStage>
    </div>
  )
}

/**
 * A hidden row. Note what that does to the row's NAME: the label span takes the
 * `hidden` utility (`display: none`), so a hidden entry renders as an unnamed
 * toggle — the third row here. The switch keeps its accessible name ("Show
 * SRD") via `Toggle`'s own label, so this is a visual gap rather than an a11y
 * one, but a sighted user cannot tell which entry they would be re-showing.
 */
export function HiddenRow() {
  const rows = [
    { id: 'actions', label: 'Actions', hidden: false, locked: true },
    { id: 'tables', label: 'Tables', hidden: false },
    { id: 'srd', label: 'SRD', hidden: true },
    { id: 'mech', label: 'Mech', hidden: false },
  ]
  return (
    <div className="flex flex-col gap-4">
      <Caption>a hidden row (3rd) — the label is not rendered</Caption>
      <InstrumentStage width={280}>
        <div style={{ position: 'relative', height: 320 }}>
          <DialConfig rows={rows} onToggle={() => {}} onMove={() => {}} onClose={() => {}} />
        </div>
      </InstrumentStage>
    </div>
  )
}
