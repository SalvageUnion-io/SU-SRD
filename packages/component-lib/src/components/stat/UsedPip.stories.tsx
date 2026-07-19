import type { Story } from '@ladle/react'
import { useState } from 'react'

import { Caption } from '../../stories/_harness'
import { UsedPip } from './UsedPip'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Used Pip',
}

/**
 * All states. UsedPip has no count/size props — it is a single once-per-rest
 * marker whose real axes are: `used` (unused ⇒ dashed empty cell, used ⇒ filled
 * accent cell), read-only vs. always-live (`onToggle`), the `label` segment, and
 * the accent tone (rust off a sheet, `--tone` inside one).
 */
export const Default: Story = () => {
  const [overclock, setOverclock] = useState(false)
  const [repairKit, setRepairKit] = useState(true)
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Caption>Read-only · unused</Caption>
        <UsedPip used={false} subject="Overclock" />
      </div>
      <div>
        <Caption>Read-only · used</Caption>
        <UsedPip used subject="Overclock" />
      </div>
      <div>
        <Caption>Custom label · read-only used</Caption>
        <UsedPip used label="Spent" subject="Repair Kit" />
      </div>
      <div>
        <Caption>Always-live toggle (rust accent)</Caption>
        <UsedPip used={overclock} subject="Overclock" onToggle={setOverclock} />
      </div>
      <div className="sheet--pilot">
        <Caption>Always-live toggle on a Pilot sheet (--tone accent)</Caption>
        <UsedPip used={repairKit} label="Spent" subject="Repair Kit" onToggle={setRepairKit} />
      </div>
    </div>
  )
}
