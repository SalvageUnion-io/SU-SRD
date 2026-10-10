import type { CSSProperties } from 'react'
import { useState } from 'react'
import { space } from '../../../design/tokens'
import type { Story } from '../../../stories/_harness'
import { Caption } from '../../../stories/_harness'
import type { EntityStatus } from '../../shared/entityStatus'
import { StatusRail, StatusTriState } from './StatusRail'

export default {
  title: 'Atoms/Status Tri State',
}

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  maxWidth: '22rem',
} satisfies CSSProperties

const NEXT: Record<EntityStatus, EntityStatus> = {
  intact: 'damaged',
  damaged: 'destroyed',
  destroyed: 'intact',
}

/**
 * An item's condition as one framed Intact / Damaged / Destroyed group, the
 * current state an ink plate (board E3). With a handler the whole group is one
 * 44px button that steps to the next state; without one it only reads. A card
 * draws it in its body's dashed rail beside Remove; the pilot sheet's Edit
 * state draws it under an item's shortform pill.
 */
export const Default: Story = () => {
  const [status, setStatus] = useState<EntityStatus>('intact')
  return (
    <div style={STACK}>
      <div>
        <Caption>Live: press to step the condition</Caption>
        <StatusTriState
          status={status}
          onClick={() => setStatus(NEXT[status])}
          subject="Riveting Gun"
        />
      </div>
      <div>
        <Caption>Read-only</Caption>
        <StatusTriState status="damaged" onClick={undefined} subject="First Aid Kit" />
      </div>
      <div>
        <Caption>In a card body&rsquo;s rail, beside Remove</Caption>
        <StatusRail
          status={status}
          onStatusClick={() => setStatus(NEXT[status])}
          removers={[{ key: 'remove', label: 'Remove', variant: 'danger', onClick: () => {} }]}
          subject="Riveting Gun"
          size="medium"
        />
      </div>
    </div>
  )
}
