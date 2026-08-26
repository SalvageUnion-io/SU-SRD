/*
 * Ported from packages/component-lib/src/components/shared/RecoveryPanel.stories.tsx.
 * RecoveryPanel is content-agnostic chrome — no SRD entity flows through it — so
 * the cells carry the REAL production copy the two apps ship.
 */
import { RecoveryPanel } from 'component-lib'

/** The generic root error. */
export function Generic() {
  return (
    <div className="bg-paper p-4">
      <RecoveryPanel
        title="Something went wrong"
        message="The app hit an unexpected error. Your saved data is stored locally and is not affected."
        action={{ label: 'Reload app', onClick: () => {} }}
      />
    </div>
  )
}

/** The blocked-upgrade case — another tab holds an older version open. */
export function BlockedUpgrade() {
  return (
    <div className="bg-paper p-4">
      <RecoveryPanel
        title="Close the other tab"
        message="In the Union Now is open in another browser tab running an older version, which is blocking this one from loading. Close every other In the Union Now tab, then reload. Your saved data is safe."
        action={{ label: 'Reload', onClick: () => {} }}
      />
    </div>
  )
}

/** With a developer dump in the children slot. */
export function WithDevDump() {
  return (
    <div className="bg-paper p-4">
      <RecoveryPanel
        title="Something went wrong"
        message="The app hit an unexpected error. Your saved data is stored locally and is not affected."
        action={{ label: 'Reload app', onClick: () => {} }}
      >
        <pre className="max-w-full overflow-auto rounded-card border-chrome border-ink/20 bg-wk-bg p-3 text-left text-xs text-ink">
          Cannot read properties of undefined (reading 'chassis')
        </pre>
      </RecoveryPanel>
    </div>
  )
}
