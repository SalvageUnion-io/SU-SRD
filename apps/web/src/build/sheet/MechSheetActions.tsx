/**
 * MOCK (Working Manual D, the timing law): a mech sheet's actions, grouped by
 * when they can be used (Turn, Short, Long, Free, Reaction, Passive), the
 * same groups Play's Act pane draws. Every action of the chassis and of each
 * installed System and Module (`buildMechActions`) is one compact row: the
 * contentful Mini's head alone (name, range, damage, traits, cost), its name
 * Peeking its rules; the source is said as a small chip where the action is
 * not named for it. The sheet reads here: Use is Play's (ADR-021).
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties } from 'react'
import { toEntityModel } from 'salvageunion-reference'
import { EmptyState, Entity, MiniGrid, Slab, Stat, tokens } from '../../components/index'
import type { PlayAction } from '../../lib/rules/actionPatches'
import { buildMechActions } from '../../lib/rules/actionPatches'
import type { ActionTypeKey } from '../../play/playActions.model'
import { actionTypeOf } from '../../play/playActions.model'

const GROUPS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

const GROUP = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
} satisfies CSSProperties

/** The rows print no text: the head carries the facts, the Peek the rules. */
const HEAD_ONLY = { text: false } as const

const TIMING: readonly ActionTypeKey[] = [
  'Turn',
  'Short',
  'Long',
  'Free',
  'Reaction',
  'Passive',
  'Downtime',
  'Other',
]

function ActionRow({ action }: { action: PlayAction }) {
  const model = toEntityModel(action.action)
  return (
    <li>
      <Entity
        size="mini"
        context="play"
        model={model}
        tint="mech"
        instance={action.condition === 'destroyed' ? { condition: 'destroyed' } : undefined}
        {...(action.ownerName !== action.name
          ? { state: <Stat size="mini" label={action.ownerName} /> }
          : {})}
        body={HEAD_ONLY}
      />
    </li>
  )
}

export function MechSheetActions({ mech }: { mech: Mech }) {
  const actions = buildMechActions(mech)
  const groups = TIMING.map((type) => ({
    type,
    actions: actions.filter((a) => actionTypeOf(a.action) === type),
  })).filter((group) => group.actions.length > 0)
  if (groups.length === 0) return <EmptyState variant="quiet" body="No actions yet." />
  return (
    <div style={GROUPS}>
      {groups.map((group) => (
        <section key={group.type} aria-label={group.type} style={GROUP}>
          <Slab as="h3" size="mini" label={group.type} count={group.actions.length} />
          <MiniGrid label={`${group.type} actions`}>
            {group.actions.map((action) => (
              <ActionRow key={action.key} action={action} />
            ))}
          </MiniGrid>
        </section>
      ))}
    </div>
  )
}
