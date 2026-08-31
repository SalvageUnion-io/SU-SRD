/*
 * Composed from the Storage story in
 * packages/component-lib/src/components/dashboard/ActiveItemBand.stories.tsx.
 * `StorageBay` ships from `./ActiveItemBand` and has no story file of its own —
 * it is demonstrated there inside the cargo-hold overlay. Shown on its own here,
 * since that is how the card picker lists it.
 */
import { StorageBay } from 'component-lib'
import { Caption, InstrumentStage } from '../preview-lib/harness'

const LOTS = [
  { id: 'l1', code: 'SCR', name: 'Scrap', kind: 'bulk', qty: 3, units: 3 },
  { id: 'l2', code: 'CHM', name: 'Chimerium Shard', kind: 'unit', units: 1 },
]

/**
 * The cargo-hold lot list. `bulk` lots carry a quantity, `unit` lots do not, and
 * the header reads used against capacity. Jettison is destructive.
 */
export function Lots() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>a partly-filled hold — bulk and unit lots</Caption>
      <InstrumentStage width={420}>
        <StorageBay
          lots={LOTS}
          used={LOTS.reduce((n, l) => n + l.units, 0)}
          cap={5}
          onJettison={() => {}}
        />
      </InstrumentStage>
    </div>
  )
}

/** Empty and at capacity — the two ends of the readout. */
export function Bounds() {
  const full = [
    ...LOTS,
    { id: 'l3', code: 'ORE', name: 'Raw Ore', kind: 'bulk', qty: 1, units: 1 },
  ]
  return (
    <div className="flex flex-col gap-4">
      <Caption>empty</Caption>
      <InstrumentStage width={420}>
        <StorageBay lots={[]} used={0} cap={5} onJettison={() => {}} />
      </InstrumentStage>
      <Caption>at capacity</Caption>
      <InstrumentStage width={420}>
        <StorageBay lots={full} used={5} cap={5} onJettison={() => {}} />
      </InstrumentStage>
    </div>
  )
}
