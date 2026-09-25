import { Caption } from 'component-lib/stories/harness'
import { useState } from 'react'
import type { CockpitPrefs, DialKind } from '../../lib/schemas/cockpitPrefs'
import { InstrumentStage } from './_dashboardStage'
import { DialConfig } from './DialConfig'

export default { title: 'Compositions/Dashboard/Dial Config' }

const KINDS: DialKind[] = ['actions', 'tables', 'srd', 'mech', 'pilot', 'crawler']

/**
 * The ⚙ dial-config overlay: show/hide rows via the switch, reorder with ▲▼.
 * "Actions" is locked visible. Interactive — the story holds the CockpitPrefs
 * the Dashboard would persist against the owning container.
 */
export const Default = () => {
  const [prefs, setPrefs] = useState<CockpitPrefs>({ order: KINDS, hidden: ['srd'] })
  return (
    <div className="flex flex-col gap-4">
      <Caption>Dial configuration overlay — reorderable show/hide list.</Caption>
      <InstrumentStage width={260}>
        <div style={{ position: 'relative', height: 320 }}>
          <DialConfig kinds={KINDS} prefs={prefs} onChange={setPrefs} onClose={() => {}} />
        </div>
      </InstrumentStage>
    </div>
  )
}
