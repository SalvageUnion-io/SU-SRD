import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { TablePickerOverlay } from './TablePickerOverlay'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Compositions/Dashboard/TablePickerOverlay' }

/**
 * The full Tables picker — every SRD roll table sorted into its five columns
 * (Combat / Pilot / Salvage / Crawler / Downtime). Light "document under glass"
 * overlay. Real roll tables from the ORM; picking one highlights it.
 */
export const Default: Story = () => {
  const tables = SalvageUnionReference.RollTables.all().map((t) => ({ id: t.id, name: t.name }))
  const [selected, setSelected] = useState<string | null>(tables[0]?.id ?? null)
  return (
    <div className="flex flex-col gap-4">
      <Caption>Tables picker — 5 category columns, real SRD roll tables.</Caption>
      <InstrumentStage width={760}>
        <div style={{ position: 'relative', height: 440 }}>
          <TablePickerOverlay
            tables={tables}
            selectedId={selected}
            onPick={setSelected}
            onClose={() => {}}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
