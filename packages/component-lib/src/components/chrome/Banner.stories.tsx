import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { Banner } from './Banner'
import type { BannerWarning } from './Banner'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Banner',
}

/** Story-caption: names the variant under each cluster. */
function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-cond text-label uppercase tracking-caps text-wk-muted">{label}</span>
      {children}
    </div>
  )
}

// Real Salvage Union soft-warnings: an illegal starting pattern, and a pilot
// out of Energy Points — the actual advisory copy ITUN raises on the mech sheet.
const LEGAL_PATTERN_WARNING: BannerWarning = {
  severity: 'info',
  message: 'This pattern is not a legal starting pattern.',
}
const NO_EP_WARNING: BannerWarning = {
  severity: 'warn',
  message: '0 EP — some actions unavailable.',
}
const AUTOSAVE_WARNING: BannerWarning = {
  severity: 'info',
  message: 'Auto-saved to this device.',
}

/**
 * The canonical strip: an `info` row with both confirm-and-proceed actions
 * (ghost, never rust), a `warn` row, then a passive info-only row with no
 * buttons — the Banner is advisory and never blocks.
 */
export const Default: Story = () => (
  <div className="max-w-md bg-paper p-4">
    <div className="flex flex-col gap-6">
      <Cluster label="info · with actions">
        <Banner warnings={[LEGAL_PATTERN_WARNING]} onSaveAnyway={() => {}} onFixIt={() => {}} />
      </Cluster>
      <Cluster label="warn · no actions">
        <Banner warnings={[NO_EP_WARNING]} />
      </Cluster>
      <Cluster label="info · passive (info-only)">
        <Banner warnings={[AUTOSAVE_WARNING]} />
      </Cluster>
    </div>
  </div>
)

/** Multiple severities stacked in one strip, with both actions below the list. */
export const Stacked: Story = () => (
  <div className="max-w-md bg-paper p-4">
    <Banner
      warnings={[LEGAL_PATTERN_WARNING, NO_EP_WARNING]}
      onSaveAnyway={() => {}}
      onFixIt={() => {}}
    />
  </div>
)

/** Empty `warnings` renders nothing — a zero-DOM strip. */
export const Empty: Story = () => (
  <div className="max-w-md bg-paper p-4">
    <Cluster label="warnings={[]} — renders nothing">
      <Banner warnings={[]} />
    </Cluster>
  </div>
)
