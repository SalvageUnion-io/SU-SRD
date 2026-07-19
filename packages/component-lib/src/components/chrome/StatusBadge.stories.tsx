import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { StatusBadge } from './StatusBadge'
import type { EntityStatus } from './StatusBadge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Status Badge',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx before
// any story chunk imports, so module-top-level access is safe here.
const chassis = SalvageUnionReference.Chassis.all()[0]
const chassisName = chassis?.name ?? 'Chassis'

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
  <div className="flex flex-col gap-4">
    <div>
      <Caption>All states (static span)</Caption>
      <div className="flex flex-wrap items-start gap-3">
        {STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
    </div>
    <div>
      <Caption>Clickable (cycle handler, with subject)</Caption>
      <div className="flex flex-wrap items-start gap-3">
        {STATUSES.map((status) => (
          <CyclingStatusBadge key={status} initial={status} />
        ))}
      </div>
    </div>
  </div>
)
