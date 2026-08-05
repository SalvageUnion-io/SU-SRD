import type { Story } from '@ladle/react'
import { RecoveryPanel } from './RecoveryPanel'

export default {
  title: 'Containers/Recovery Panel',
}

// RecoveryPanel is content-agnostic chrome — no SRD entity flows through it.
// The stories use the REAL production copy the two apps ship: srd's island
// error boundary, itun's generic root error, and itun's blocked-upgrade case.
const noop = () => {}

export const Default: Story = () => (
  <RecoveryPanel
    title="Something went wrong"
    message="The app hit an unexpected error. Your saved data is stored locally and is not affected."
    action={{ label: 'Reload app', onClick: noop }}
  />
)

export const BlockedUpgrade: Story = () => (
  <RecoveryPanel
    title="Close the other tab"
    message="In the Union Now is open in another browser tab running an older version, which is blocking this one from loading. Close every other In the Union Now tab, then reload. Your saved data is safe."
    action={{ label: 'Reload', onClick: noop }}
  />
)

export const WithDevDump: Story = () => (
  <RecoveryPanel
    title="Something went wrong"
    message="The app hit an unexpected error. Your saved data is stored locally and is not affected."
    action={{ label: 'Reload app', onClick: noop }}
  >
    <pre className="max-w-full overflow-auto rounded-card border-chrome border-ink/20 bg-wk-bg p-3 text-left text-xs text-ink">
      Cannot read properties of undefined (reading 'chassis')
    </pre>
  </RecoveryPanel>
)
