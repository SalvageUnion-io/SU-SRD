/*
 * Ported from packages/component-lib/src/components/dashboard/ActiveItemBand.stories.tsx.
 * The story opens the overlay by clicking "Take Dmg"; the overlay is rendered
 * open here, since that state is the more interesting half and a card cannot
 * click.
 */
import { ActiveItemBand, CountStepper, StorageBay } from 'component-lib'
import { Caption, InstrumentStage } from '../preview-lib/harness'

const BAYS = [
  {
    label: 'Reactor',
    gauges: [
      { label: 'Heat', value: 5, max: 6, tone: 'mech', danger: 4 },
      { label: 'EP', value: 3, max: 4, tone: 'mech' },
    ],
    buttons: [
      { label: 'Push', onClick: () => {}, variant: 'danger' },
      { label: 'Heat Chk', onClick: () => {}, variant: 'danger' },
      { label: 'Vent', onClick: () => {} },
      { label: 'Shutdn', onClick: () => {} },
    ],
  },
  {
    label: 'Chassis',
    gauges: [
      { label: 'SP', value: 4, max: 6, tone: 'mech' },
      { label: 'Cargo', value: 2, max: 5, tone: 'mech' },
    ],
    buttons: [
      { label: 'Take Dmg', onClick: () => {} },
      { label: 'Storage', onClick: () => {} },
    ],
  },
  {
    label: 'Egress',
    buttons: [
      { label: 'Dismount', onClick: () => {} },
      { label: 'Eject', onClick: () => {}, variant: 'danger' },
    ],
  },
]

/**
 * The Active Item band on the mech mount: responsibility bays (Reactor /
 * Chassis / Egress), each with instrument gauges and a button grid. The ITUN
 * wrapper wires the rules; this is presentational.
 */
export function Bays() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>active item band (mech) — responsibility bays</Caption>
      <InstrumentStage width={520}>
        <div style={{ height: 200 }}>
          <ActiveItemBand
            view={{ fam: 'mech', stampLabel: 'Mech · Iron Mongrel', bays: BAYS, overlay: null }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}

/** The resolve overlay — a player-confirmed step, here Take Structure Damage. */
export function ResolveOverlay() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>resolve overlay — the damage step, awaiting confirmation</Caption>
      <InstrumentStage width={520}>
        <div style={{ height: 200 }}>
          <ActiveItemBand
            view={{
              fam: 'mech',
              stampLabel: 'Mech · Iron Mongrel',
              bays: BAYS,
              overlay: {
                title: 'Take Structure Damage',
                onClose: () => {},
                body: (
                  <CountStepper
                    count={2}
                    onChange={() => {}}
                    subject="damage point"
                    min={1}
                    surface="instrument"
                  />
                ),
                actions: [{ label: 'Apply −2 SP', onClick: () => {}, variant: 'danger' }],
              },
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}

/** The Cargo Hold overlay — the `StorageBay` list, where Jettison is destructive. */
export function CargoHold() {
  const lots = [
    { id: 'l1', code: 'SCR', name: 'Scrap', kind: 'bulk', qty: 3, units: 3 },
    { id: 'l2', code: 'CHM', name: 'Chimerium Shard', kind: 'unit', units: 1 },
  ]
  return (
    <div className="flex flex-col gap-4">
      <Caption>cargo hold overlay — StorageBay with Jettison</Caption>
      <InstrumentStage width={520}>
        <div style={{ height: 200 }}>
          <ActiveItemBand
            view={{
              fam: 'mech',
              stampLabel: 'Mech · Iron Mongrel',
              bays: [{ label: 'Chassis', buttons: [{ label: 'Storage', onClick: () => {} }] }],
              overlay: {
                title: 'Cargo Hold',
                onClose: () => {},
                body: (
                  <StorageBay
                    lots={lots}
                    used={lots.reduce((n, l) => n + l.units, 0)}
                    cap={5}
                    onJettison={() => {}}
                  />
                ),
              },
            }}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
