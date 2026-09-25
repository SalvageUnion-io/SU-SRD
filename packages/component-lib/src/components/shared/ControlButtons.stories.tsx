import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import { Caption } from '../../stories/_harness'
import type { ReferenceEntityControl } from '../referenceEntity/referenceEntityControlTypes'
import { ControlButtons } from './ControlButtons'
import type { EntityStatus } from './entityStatus'

export default {
  title: 'Compositions/Entity/Control Buttons',
}

/**
 * ControlButtons — the strip a card's control rail renders, and what ITUN's
 * Dashboard display panel lays out beneath an entity it cannot resolve. One
 * `ReferenceEntityControl[]` carries every affordance, each rendered by its
 * matching primitive: a quantity stepper, a read-only stamp, the entity
 * condition toggle, a navigation link, and plain action buttons.
 */
export const Default: Story = () => {
  const system = SalvageUnionReference.Systems.all()[0]
  const name = system?.name ?? 'System'
  const [uses, setUses] = useState(2)
  const [status, setStatus] = useState<EntityStatus>('intact')
  const next: Record<EntityStatus, EntityStatus> = {
    intact: 'damaged',
    damaged: 'destroyed',
    destroyed: 'intact',
  }

  const controls: ReferenceEntityControl[] = [
    {
      key: 'uses',
      stepper: { count: uses, onChange: setUses, subject: name, min: 0, max: 3, label: 'Uses' },
    },
    { key: 'ep', badge: '2 EP' },
    {
      key: 'status',
      status: { value: status, onClick: () => setStatus(next[status]), subject: name },
    },
    { key: 'sheet', href: '#', label: 'Full mech sheet →' },
    {
      key: 'load',
      label: 'Load Into Mech ▶',
      ariaLabel: 'Load Into Mech',
      onClick: () => {},
      variant: 'primary',
    },
    {
      key: 'remove',
      label: 'Remove',
      ariaLabel: `Remove ${name}`,
      onClick: () => {},
      variant: 'danger',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
      <Caption>{name} — stepper, stamp, condition, link and action controls</Caption>
      <ControlButtons controls={controls} />
    </div>
  )
}
