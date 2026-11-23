/**
 * What a unit's box says of its state besides its vitals (play.md §4): a
 * mech's Shut down and Vulnerable (r7 B2), and a pilot's Critical Injury
 * offered to the sheet (r7 B6). Plain level-2 content: chips and a button.
 */

import { pilotLabel } from 'game-domain/pilotLabel'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, Stat, Text, tokens } from '../components/index'
import { changesUndoToast } from '../lib/changeUndoToast'
import { runWrite } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { PLAY_TXN } from '../replica/provenance'
import type { UnitsStore } from '../replica/units'
import { rolledInjury } from './criticalInjury.model'
import { usePlayRollLog } from './playRolls.model'
import { powerBackOn, REACTOR_STATE_TEXT, reactorStates } from './reactorWrites.model'

type UnitStore = UnitsStore

/** A row of level-2 chips, wrapping as a whole, as the box's others are. */
const CHIPS = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

/**
 * Shut down and Vulnerable, as chips under the vitals (r7 B2), never only the
 * Reactor row's toggle: a live mech's Shut down offers Power back on, as the
 * result's own duration says (Core Book p.235). Nothing shows while it runs.
 */
export function ReactorStates({
  mech,
  live,
  store,
}: {
  mech: Mech
  live: boolean
  store: UnitStore
}) {
  const states = reactorStates(mech.conditions)
  if (states.length === 0) return null
  const shut = states.includes('shutdown')
  return (
    <div style={CHIPS}>
      {states.map((state) => (
        <Stat
          key={state}
          size="mini"
          state="critical"
          label={REACTOR_STATE_TEXT[state]}
          {...(state === 'shutdown' ? { hoverText: playCopy('shutDownReactivates') } : {})}
        />
      ))}
      {shut && live ? (
        <Button
          size="mini"
          aria-label={playCopy('powerBackOnOf', { name: mech.name })}
          onClick={() => powerBackOn(store.getState(), mech)}
        >
          {playCopy('powerBackOn')}
        </Button>
      ) : null}
    </div>
  )
}

/** The Critical Injury rolls already applied in this tab, by roll id. */
const appliedInjuries = new Set<string>()

/**
 * The last roll's Critical Injury, offered to the pilot's sheet (r7 B6): one
 * press writes the injury, and with it the Max HP it costs, as an injury on
 * the sheet does, with Undo. Offered only while that roll is the newest.
 */
export function ApplyInjury({
  pilot,
  maxHp,
  store,
}: {
  pilot: Pilot
  maxHp: number
  store: UnitStore
}) {
  const last = usePlayRollLog().at(-1)
  const [, applied] = useState(0)
  const injury = last === undefined ? null : rolledInjury(last)
  if (last === undefined || injury === null || appliedInjuries.has(last.id)) return null
  const name = playCopy(injury === 'major' ? 'majorInjury' : 'minorInjury')
  const apply = () => {
    const before = pilot.injuries ?? []
    const write = (injuries: Pilot['injuries']) =>
      store.getState().update('pilot', pilot.id, { injuries }, PLAY_TXN)
    appliedInjuries.add(last.id)
    applied((n) => n + 1)
    runWrite(
      () => write([...before, { severity: injury, note: '' }]),
      () =>
        changesUndoToast({
          id: `pilot:${pilot.id}:injuries`,
          did: playCopy('injuryApplied', { injury: name }),
          changes: [
            {
              key: 'maxHp',
              label: playCopy('maxHp'),
              from: maxHp,
              to: maxHp - (injury === 'major' ? 2 : 1),
            },
          ],
          undo: () => runWrite(() => write(before)),
        })
    )
  }
  return (
    <Text variant="note">
      <Button
        size="compact"
        aria-label={playCopy('applyInjuryTo', { injury: name, name: pilotLabel(pilot) })}
        onClick={apply}
      >
        {playCopy('applyInjury', { injury: name })}
      </Button>
    </Text>
  )
}
