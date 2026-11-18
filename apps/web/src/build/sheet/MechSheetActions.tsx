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
import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import { toEntityModel } from 'salvageunion-reference'
import { EmptyState, Entity, MiniGrid, Slab, Stat, tokens } from '../../components/index'
import type { PlayAction } from '../../lib/rules/actionPatches'
import { buildMechActions, buildPilotActions } from '../../lib/rules/actionPatches'
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

/** The rows print the action's text under the head; the Peek has the whole card. */
const ROW_TEXT = {} as const

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

/** The Mini's tint: the unit's kind on the colour map. */
type Tint = 'mech' | 'pilot'

function ActionRow({ action, tint }: { action: PlayAction; tint: Tint }) {
  // MOCK (wave 2): a carried item's picks change its text, cost, Range and
  // Damage here as they do in Play (`PlayActionRow`).
  const from = action.choices?.from
  const selections = action.choices?.selections
  const model = toEntityModel(
    action.action,
    selections ? { selections } : {},
    from ? { choices: from } : undefined
  )
  return (
    <li>
      <Entity
        size="mini"
        context="play"
        model={model}
        tint={tint}
        instance={action.condition === 'destroyed' ? { condition: 'destroyed' } : undefined}
        {...(action.ownerName !== action.name
          ? { state: <Stat size="mini" label={action.ownerName} /> }
          : {})}
        // MOCK (wave 2): the row prints the action's own text under its head.
        body={ROW_TEXT}
      />
    </li>
  )
}

export function MechSheetActions({ mech }: { mech: Mech }) {
  return <SheetActions actions={buildMechActions(mech)} tint="mech" />
}

/** MOCK (wave 2): the pilot's twin: abilities and equipment, by timing. */
export function PilotSheetActions({ pilot }: { pilot: Pilot }) {
  return <SheetActions actions={buildPilotActions(pilot)} tint="pilot" />
}

/** MOCK (wave 2): any unit's actions by timing, the one list both sheets draw. */
function SheetActions({ actions, tint }: { actions: readonly PlayAction[]; tint: Tint }) {
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
              <ActionRow key={action.key} action={action} tint={tint} />
            ))}
          </MiniGrid>
        </section>
      ))}
    </div>
  )
}
