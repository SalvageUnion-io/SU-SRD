import type { Story } from '@ladle/react'
import { useState } from 'react'

import { UsedPip } from './UsedPip'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Used Pip',
}

/** All states — read-only (static) + the always-live toggle. */
export const Default: Story = () => {
  const [used, setUsed] = useState(false)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="w-40 font-cond text-badge uppercase tracking-caps text-wk-muted">
          Read-only · unused
        </span>
        <UsedPip used={false} />
      </div>
      <div className="flex items-center gap-3">
        <span className="w-40 font-cond text-badge uppercase tracking-caps text-wk-muted">
          Read-only · used
        </span>
        <UsedPip used />
      </div>
      <div className="flex items-center gap-3 sheet--pilot">
        <span className="w-40 font-cond text-badge uppercase tracking-caps text-wk-muted">
          Live toggle (Overclock)
        </span>
        <UsedPip used={used} subject="Overclock" onToggle={setUsed} />
      </div>
    </div>
  )
}
