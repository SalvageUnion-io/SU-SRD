/**
 * PlayNpcGroup — one encounter group on the Mediator's Opposition (ADR-059
 * §5): its name on a Slab with one Reaction and one Morale roll for the whole
 * group (p.267-268), kept on each member still standing; then how many of it
 * are down, Morale due when half of it has fallen (Core Book p.268), and its
 * last roll. Its members' boxes follow, in its own list.
 *
 * Due is a prompt, never a roll: the Mediator presses Morale (ADR-007), and
 * nothing retreats or leaves the tray on its own.
 */

import type { ReactNode } from 'react'
import { Button, Slab, Stat } from '../../components/index'
import { groupMoraleDue } from '../../lib/rules/opposition'
import { mediatorCopy } from '../../messages/play-mediator'
import { CONTROLS } from './mediatorStyles.model'
import type { TrayNpc } from './opposition.model'
import { groupRoll } from './opposition.model'
import { RollResultLine } from './RollResultLine'

type PlayNpcGroupProps = {
  id: string
  name: string
  members: readonly TrayNpc[]
  canWrite: boolean
  /** Roll one table for the whole group. */
  onRoll: (table: 'reaction' | 'morale') => void
  /** Its members' boxes. */
  children: ReactNode
}

export function PlayNpcGroup({ id, name, members, canWrite, onRoll, children }: PlayNpcGroupProps) {
  const down = members.filter((m) => m.down).length
  const due = groupMoraleDue(members)
  const last = groupRoll(members)
  const live = canWrite && down < members.length
  const rollButton = (table: 'reaction' | 'morale') => {
    const label = mediatorCopy(table === 'reaction' ? 'reactionTable' : 'moraleTable')
    return (
      <Button
        size="compact"
        disabled={!live}
        aria-label={mediatorCopy('rollTableFor', { table: label, name })}
        onClick={() => onRoll(table)}
      >
        {label}
      </Button>
    )
  }
  return (
    <li className="su-play-group" data-group={id}>
      <Slab
        as="h3"
        flush
        label={name}
        actions={
          <span style={CONTROLS}>
            {rollButton('reaction')}
            {rollButton('morale')}
          </span>
        }
      />
      <span style={CONTROLS}>
        <Stat size="mini" label={mediatorCopy('groupDown', { down, size: members.length })} />
        {due ? <Stat size="mini" label={mediatorCopy('moraleDue')} state="caution" /> : null}
      </span>
      <RollResultLine roll={last} empty={mediatorCopy('noGroupRoll')} />
      <ul className="su-play-npcs" aria-label={mediatorCopy('groupMembers', { name })}>
        {children}
      </ul>
    </li>
  )
}
