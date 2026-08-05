import type { Story } from '@ladle/react'
import { useState } from 'react'
import { InstrumentStage } from '../../stories/_dashboardStage'
import { Caption } from '../../stories/_harness'
import type { DialItem } from './Dial'
import { Dial } from './Dial'
import type { DialConfigRow } from './DialConfig'
import { DialConfig } from './DialConfig'

export default { title: 'Compositions/Dashboard/Dial' }

const ITEMS: DialItem[] = [
  { key: 'actions', statless: true, label: 'Actions', sublabel: 'deck' },
  { key: 'tables', statless: true, label: 'Tables', sublabel: 'roll' },
  {
    key: 'mech',
    statless: false,
    label: 'Iron Mongrel',
    tone: 'mech',
    gauges: [
      { label: 'SP', value: 4, max: 6, tone: 'mech' },
      { label: 'HEAT', value: 5, max: 6, tone: 'mech', danger: 4 },
    ],
  },
  {
    key: 'pilot',
    statless: false,
    label: 'Vesna Kroll',
    tone: 'pilot',
    gauges: [{ label: 'HP', value: 8, max: 10, tone: 'pilot' }],
  },
]

const CONFIG_ROWS: DialConfigRow[] = [
  { id: 'actions', label: 'Actions', hidden: false, locked: true },
  { id: 'tables', label: 'Tables', hidden: false },
  { id: 'mech', label: 'Mech', hidden: false },
  { id: 'pilot', label: 'Pilot', hidden: false },
]

/**
 * The momentum dial: ▲▼ step it, click a track card to jump, drag to spin. The
 * viewfinder card (top) is the active selection; ⚙ opens the config overlay.
 */
export const Default: Story = () => {
  const [idx, setIdx] = useState(0)
  return (
    <div className="flex flex-col gap-4">
      <Caption>
        Rotary dial — active card in the viewfinder drives the display; ⚙ configures.
      </Caption>
      <InstrumentStage width={300}>
        <div style={{ height: 520 }}>
          <Dial
            items={ITEMS}
            activeIndex={idx}
            onActiveIndexChange={setIdx}
            renderConfig={(close) => (
              <DialConfig
                rows={CONFIG_ROWS}
                onToggle={() => {}}
                onMove={() => {}}
                onClose={close}
              />
            )}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
