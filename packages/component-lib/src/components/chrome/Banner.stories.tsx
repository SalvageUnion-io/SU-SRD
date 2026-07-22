import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { Banner } from './Banner'
import type { BannerWarning } from './Banner'

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
 * The canonical strip: an `info` row, a `warn` row, then a second info row —
 * every row is purely informational; the Banner is advisory and never blocks.
 */
export const Default: Story = () => (
  <div className="max-w-md bg-paper p-4">
    <div className="flex flex-col gap-6">
      <Cluster label="info">
        <Banner warnings={[LEGAL_PATTERN_WARNING]} />
      </Cluster>
      <Cluster label="warn">
        <Banner warnings={[NO_EP_WARNING]} />
      </Cluster>
      <Cluster label="info · passive">
        <Banner warnings={[AUTOSAVE_WARNING]} />
      </Cluster>
    </div>
  </div>
)

/** Multiple severities stacked in one strip. */
export const Stacked: Story = () => (
  <div className="max-w-md bg-paper p-4">
    <Banner warnings={[LEGAL_PATTERN_WARNING, NO_EP_WARNING]} />
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
