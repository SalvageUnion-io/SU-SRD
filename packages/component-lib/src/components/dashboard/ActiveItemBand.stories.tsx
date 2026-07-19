import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { InstrumentStage } from '../../stories/_dashboardStage'
import {
  ActiveItemBand,
  DamageStepper,
  StorageBay,
  type ActiveItemBandView,
  type StorageLot,
} from './ActiveItemBand'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Compositions/Dashboard/Active Item Band' }

/**
 * The Active Item band (mech mount): responsibility bays (Reactor / Chassis /
 * Egress) each with instrument gauges + a button grid, and a resolve overlay for
 * player-confirmed steps. Real SU vitals; the ITUN wrapper wires the rules.
 */
export const Default: Story = () => {
  const [dmg, setDmg] = useState(2)
  const [overlay, setOverlay] = useState(false)
  const view: ActiveItemBandView = {
    fam: 'mech',
    stampLabel: 'Mech · Iron Mongrel',
    bays: [
      {
        label: 'Reactor',
        gauges: [
          { label: 'Heat', value: 5, max: 6, tone: 'mech', danger: 4 },
          { label: 'EP', value: 3, max: 4, tone: 'mech' },
        ],
        buttons: [
          { label: 'Push', onClick: () => {}, danger: true },
          { label: 'Heat Chk', onClick: () => {}, danger: true },
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
          { label: 'Take Dmg', onClick: () => setOverlay(true) },
          { label: 'Storage', onClick: () => {} },
        ],
      },
      {
        label: 'Egress',
        buttons: [
          { label: 'Dismount', onClick: () => {} },
          { label: 'Eject', onClick: () => {}, danger: true },
        ],
      },
    ],
    overlay: overlay
      ? {
          title: 'Take Structure Damage',
          onClose: () => setOverlay(false),
          body: <DamageStepper amount={dmg} setAmount={setDmg} />,
          actions: [{ label: `Apply −${dmg} SP`, onClick: () => setOverlay(false), danger: true }],
        }
      : null,
  }
  return (
    <div className="flex flex-col gap-4">
      <Caption>Active Item band (mech) — responsibility bays + a resolve overlay.</Caption>
      <InstrumentStage width={520}>
        <div style={{ height: 200 }}>
          <ActiveItemBand view={view} />
        </div>
      </InstrumentStage>
    </div>
  )
}

const CARGO: StorageLot[] = [
  { id: 'l1', code: 'SCR', name: 'Scrap', kind: 'bulk', qty: 3, units: 3 },
  { id: 'l2', code: 'CHM', name: 'Chimerium Shard', kind: 'unit', units: 1 },
]

/** The Cargo Hold overlay body — the StorageBay list (Jettison is destructive). */
export const Storage: Story = () => {
  const [lots, setLots] = useState(CARGO)
  const view: ActiveItemBandView = {
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
          onJettison={(id) => setLots((ls) => ls.filter((l) => l.id !== id))}
        />
      ),
    },
  }
  return (
    <div className="flex flex-col gap-4">
      <Caption>Cargo hold overlay — StorageBay with Jettison.</Caption>
      <InstrumentStage width={520}>
        <div style={{ height: 200 }}>
          <ActiveItemBand view={view} />
        </div>
      </InstrumentStage>
    </div>
  )
}
