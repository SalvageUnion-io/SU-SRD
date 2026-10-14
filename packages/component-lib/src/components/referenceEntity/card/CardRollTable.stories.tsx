import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import type { Story } from '../../../stories/_harness'
import { Caption } from '../../../stories/_harness'
import { CardRollTable } from './CardRollTable'
import { ReferenceEntityCard } from './ReferenceEntityCard'

export default {
  title: 'Compositions/Entity/Card Roll Table',
}

/**
 * The roll table an entity owns, inline in its card (board E4): hidden, open,
 * and open with a roll marked. The bar holds its place in every state; the
 * result itself is a toast (`toastRoll`), as every roll's is. Real data: the
 * Core Mechanic table, rolled at 14 (Success).
 */
const coreMechanic = SalvageUnionReference.RollTables.getByName('Core Mechanic')
if (!coreMechanic?.table) throw new Error('Card Roll Table story: Core Mechanic table missing')
const table = coreMechanic.table

/** The state inside a card's frame, as it sits under the card's body. */
function InCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[8], maxWidth: '40rem' }}>
      <Caption>{label}</Caption>
      <div
        style={{
          backgroundColor: 'var(--color-paper)',
          border: 'var(--bw-entity-compact) solid var(--color-ink)',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}

const column = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  padding: space[16],
} as const

/** All three states, plus the table as the roll-tables entity's own card renders it. */
export const Default: Story = () => (
  <div style={column}>
    <InCard label="1 · Hidden — the default everywhere">
      <CardRollTable table={table} name="Core Mechanic" size="medium" disabled={false} />
    </InCard>
    <InCard label="2 · Expanded — every outcome, nothing rolled">
      <CardRollTable
        table={table}
        name="Core Mechanic"
        size="medium"
        defaultOpen
        disabled={false}
      />
    </InCard>
    <InCard label="3 · Rolled, expanded — the marked row">
      <CardRollTable
        table={table}
        name="Core Mechanic"
        size="medium"
        defaultOpen
        disabled={false}
        defaultRoll={14}
      />
    </InCard>
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[8], maxWidth: '40rem' }}>
      <Caption>In its card — the roll-tables entity's own page</Caption>
      <ReferenceEntityCard data={coreMechanic} />
    </div>
  </div>
)
