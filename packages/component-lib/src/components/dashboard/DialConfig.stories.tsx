import type { Story } from '@ladle/react'
import { useState } from 'react'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { Caption } from '../../stories/_harness'
import type { DialConfigRow } from './DialConfig'
import { DialConfig } from './DialConfig'

export default { title: 'Compositions/Dashboard/Dial Config' }

const INITIAL: DialConfigRow[] = [
  { id: 'actions', label: 'Actions', hidden: false, locked: true },
  { id: 'tables', label: 'Tables', hidden: false },
  { id: 'srd', label: 'SRD', hidden: true },
  { id: 'mech', label: 'Mech', hidden: false },
  { id: 'pilot', label: 'Pilot', hidden: false },
  { id: 'crawler', label: 'Crawler', hidden: false },
]

/**
 * The ⚙ dial-config overlay: show/hide rows via the checkbox, reorder with ▲▼.
 * "Actions" is locked visible. Interactive — the story holds the row state the
 * app's CockpitPrefs would persist.
 */
export const Default: Story = () => {
  const [rows, setRows] = useState(INITIAL)
  const onToggle = (id: string) =>
    setRows((rs) => rs.map((r) => (r.id === id && !r.locked ? { ...r, hidden: !r.hidden } : r)))
  const onMove = (id: string, delta: -1 | 1) =>
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= rs.length) return rs
      const a = rs[i]
      const b = rs[j]
      if (!a || !b) return rs
      const next = [...rs]
      next[i] = b
      next[j] = a
      return next
    })
  return (
    <div className="flex flex-col gap-4">
      <Caption>Dial configuration overlay — reorderable show/hide list.</Caption>
      <InstrumentStage width={260}>
        <div style={{ position: 'relative', height: 320 }}>
          <DialConfig rows={rows} onToggle={onToggle} onMove={onMove} onClose={() => {}} />
        </div>
      </InstrumentStage>
    </div>
  )
}
