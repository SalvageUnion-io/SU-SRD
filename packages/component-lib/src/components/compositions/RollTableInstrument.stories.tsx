import type { ReactNode } from 'react'
import type { SURefObjectTable } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { digestColumnsTable, digestRollTable } from './digestRollTable'
import { RollStamp, RollTableInstrument } from './RollTableInstrument'

export default {
  title: 'Compositions/Entity/Roll Table Instrument',
}

/**
 * THE roll table (EDL E14): the instrument every card, guide step and SRD
 * table page draws. Its rows band in the surface's tone, cream where the
 * surface has none; a roll sets its row in ink with a "Rolled N" pennant
 * pinned to its corner, at the row's unrolled height. A
 * columns table (Callsign) is the same instrument. Real data: the Core
 * Mechanic and the Callsign Table.
 */
const tableNamed = (name: string): SURefObjectTable => {
  const table = SalvageUnionReference.RollTables.getByName(name)?.table
  if (!table) throw new Error(`Roll Table Instrument story: ${name} missing`)
  return table
}
const coreRows = digestRollTable(tableNamed('Core Mechanic'))
const callsignColumns = digestColumnsTable(tableNamed('Callsign Table'))

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[8], maxWidth: '44rem' }}>
      <Caption>{label}</Caption>
      {children}
    </div>
  )
}

export const Default: Story = () => (
  <div
    style={{
      backgroundColor: color.wkBg,
      display: 'flex',
      flexDirection: 'column',
      gap: space[24],
      padding: space[16],
    }}
  >
    <Labelled label="1 · No surface tone — the cream band">
      <RollTableInstrument
        name="Core Mechanic"
        title="Core Mechanic"
        size="medium"
        table={{ kind: 'bands', rows: coreRows }}
      />
    </Labelled>
    <Labelled label="2 · On a pilot surface, rolled 14 — the row in ink, its pennant">
      <RollTableInstrument
        name="Core Mechanic"
        title="Core Mechanic"
        size="medium"
        tone="var(--color-pilot)"
        table={{ kind: 'bands', rows: coreRows, mark: { key: '11-19', roll: 14 } }}
      />
    </Labelled>
    <Labelled label="3 · A page's table on the rules band — no title, the Roll button at its right">
      <RollTableInstrument
        name="Core Mechanic"
        size="large"
        tone="var(--color-wk-line)"
        onRoll={() => {}}
        table={{ kind: 'bands', rows: coreRows }}
      />
    </Labelled>
    <Labelled label="4 · A columns table, rolled 11 then 7 — the same instrument">
      <RollTableInstrument
        name="Callsign Table"
        title="Callsign Table"
        stamp="Roll twice:"
        size="medium"
        tone="var(--color-pilot)"
        table={{ kind: 'columns', columns: callsignColumns, mark: { column: '9-12', entry: '7' } }}
      />
    </Labelled>
  </div>
)

/**
 * `RollStamp`, ITUN's Dashboard table head's roll: given `onRoll` a button in
 * the stamp's look; without it, the plain label. On an ink band it wears a
 * paper plate. (The instrument's own roll is the shared Button.)
 */
export const Stamp: Story = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: space[16], padding: space[16] }}>
    <Labelled label="1 · The roll: a button in the stamp's look">
      <div>
        <RollStamp name="Core Mechanic" onRoll={() => {}} />
      </div>
    </Labelled>
    <Labelled label="2 · No roll here: the plain label">
      <div>
        <RollStamp name="Core Mechanic" />
      </div>
    </Labelled>
    <Labelled label="3 · On an ink band">
      <div style={{ backgroundColor: color.ink, padding: space[8] }}>
        <RollStamp name="Core Mechanic" onRoll={() => {}} onInk>
          Roll the Die
        </RollStamp>
      </div>
    </Labelled>
  </div>
)
