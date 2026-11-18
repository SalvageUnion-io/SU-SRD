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
import {
  EmptyState,
  Entity,
  MiniGrid,
  Slab,
  Stat,
  TraitProse,
  tokens,
} from '../../components/index'
import type { PlayAction } from '../../lib/rules/actionPatches'
import { buildCompanionActions, buildMechActions } from '../../lib/rules/actionPatches'
import { actionRow } from '../../lib/rules/actionRow'
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
  gap: tokens.space[8],
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
  // MOCK (wave 2, the actions board): the row Play's board draws (`actionRow`):
  // the picks applied, the effect alone as its text, a companion's row named.
  const { model, summary } = actionRow(action)
  const companion = action.companion
  return (
    <li>
      <Entity
        size="mini"
        context="play"
        model={model}
        tint={companion?.tone ?? 'mech'}
        {...(companion
          ? { relations: [{ key: `companion-${companion.id}`, name: companion.name }] }
          : {})}
        instance={action.condition === 'destroyed' ? { condition: 'destroyed' } : undefined}
        {...(action.ownerName !== action.name
          ? { state: <Stat size="mini" label={action.ownerName} /> }
          : {})}
        body={
          summary
            ? {
                text: false,
                children: <TraitProse as="p" className="su-play-act__effect" text={summary} />,
              }
            : HEAD_ONLY
        }
      />
    </li>
  )
}

export function MechSheetActions({ mech }: { mech: Mech }) {
  const actions = [
    ...buildMechActions(mech),
    ...buildCompanionActions({ kind: 'mech', id: mech.id }, mech.partners),
  ]
  const groups = TIMING.map((type) => ({
    type,
    actions: actions.filter((a) => actionTypeOf(a.action) === type),
  })).filter((group) => group.actions.length > 0)
  if (groups.length === 0) return <EmptyState variant="quiet" body="No actions yet." />
  return (
    <div className="su-timing-rows" style={GROUPS}>
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
