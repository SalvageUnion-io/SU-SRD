import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import type { EntityStatus } from '../atoms/entityStatus'
import { StatusBadge } from './StatusBadge'

export default {
  title: 'Compositions/Status Badge',
}

// Real SRD content — reference data is preloaded by catalog.tsx before
// any story chunk imports, so module-top-level access is safe here.
const chassis = SalvageUnionReference.Chassis.all()[0]
const chassisName = chassis?.name ?? 'Chassis'

const STACK = { display: 'flex', flexDirection: 'column', gap: space[16] } satisfies CSSProperties

const ROW = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[12],
} satisfies CSSProperties

const STATUSES: EntityStatus[] = ['intact', 'damaged', 'destroyed']

/** Cycle order: Intact → Damaged → Destroyed → Intact. */
const NEXT_STATUS: Record<EntityStatus, EntityStatus> = {
  intact: 'damaged',
  damaged: 'destroyed',
  destroyed: 'intact',
}

/** Clickable badge with a live cycle handler. */
function CyclingStatusBadge({ initial }: { initial: EntityStatus }) {
  const [status, setStatus] = useState<EntityStatus>(initial)
  return (
    <StatusBadge
      status={status}
      subject={chassisName}
      onClick={() => setStatus(NEXT_STATUS[status])}
    />
  )
}

/**
 * Entity status badge (ruleset §5: a composition = Badge(tone) with the entity
 * condition vocabulary Intact / Damaged / Destroyed).
 */
export const Default: Story = () => (
  <div style={STACK}>
    <div>
      <Caption>All states (static span)</Caption>
      <div style={ROW}>
        {STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
    </div>
    <div>
      <Caption>Clickable (cycle handler, with subject)</Caption>
      <div style={ROW}>
        {STATUSES.map((status) => (
          <CyclingStatusBadge key={status} initial={status} />
        ))}
      </div>
    </div>
  </div>
)
