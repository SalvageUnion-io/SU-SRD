import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { InstrumentStage } from './_dashboardStage'
import { TablePickerOverlay } from './TablePickerOverlay'

const STACK_16 = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

export default { title: 'Compositions/Dashboard/Table Picker Overlay' }

/**
 * The full Tables picker — every SRD roll table sorted into its five columns
 * (Combat / Pilot / Salvage / Crawler / Downtime). Light "document under glass"
 * overlay over the box it is portalled into. Real roll tables from the ORM;
 * picking one highlights it and closes the picker.
 */
export const Default = () => {
  const tables = SalvageUnionReference.RollTables.all().map((t) => ({ id: t.id, name: t.name }))
  const [selected, setSelected] = useState<string | null>(tables[0]?.id ?? null)
  const [open, setOpen] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  // Open once the host has mounted: the portal resolves its container on open.
  useEffect(() => setOpen(true), [])
  return (
    <div style={STACK_16}>
      <Caption>Tables picker — 5 category columns, real SRD roll tables.</Caption>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <InstrumentStage width={760}>
        <div ref={host} style={{ position: 'relative', height: 440 }}>
          <TablePickerOverlay
            open={open}
            container={host}
            tables={tables}
            selectedId={selected}
            onPick={setSelected}
            onClose={() => setOpen(false)}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
