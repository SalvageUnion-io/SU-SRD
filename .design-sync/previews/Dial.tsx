/*
 * Ported from packages/component-lib/src/components/dashboard/Dial.stories.tsx.
 * The active index is fixed rather than stateful — a card is a still image, and
 * the viewfinder is what the cell needs to show.
 */
import { Dial, DialConfig } from 'component-lib'
import { Caption, InstrumentStage } from '../preview-lib/harness'

const ITEMS = [
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

const CONFIG_ROWS = [
  { id: 'actions', label: 'Actions', hidden: false, locked: true },
  { id: 'tables', label: 'Tables', hidden: false },
  { id: 'mech', label: 'Mech', hidden: false },
  { id: 'pilot', label: 'Pilot', hidden: false },
]

/**
 * The momentum dial. ▲▼ step it, clicking a track card jumps to it, and it can
 * be dragged to spin. The viewfinder card at the top is the active selection and
 * drives the display; ⚙ opens the config overlay.
 */
export function Viewfinder() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>rotary dial — a statless entry active in the viewfinder</Caption>
      <InstrumentStage width={360}>
        <div style={{ height: 520 }}>
          <Dial
            items={ITEMS}
            activeIndex={0}
            onActiveIndexChange={() => {}}
            renderConfig={(close: () => void) => (
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

/** A statful entry active — the viewfinder carries that entity's gauges. */
export function StatfulActive() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>a mech in the viewfinder — SP and a redlining Heat gauge</Caption>
      <InstrumentStage width={360}>
        <div style={{ height: 520 }}>
          <Dial
            items={ITEMS}
            activeIndex={2}
            onActiveIndexChange={() => {}}
            renderConfig={(close: () => void) => (
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
