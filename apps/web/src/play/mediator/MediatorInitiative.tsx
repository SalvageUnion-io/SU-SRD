/**
 * MediatorInitiative — Group Initiative on Mediate's table (r6 B4, Core Book
 * p.235–236): the round, the sides (the Pilots, then each opposition group),
 * whose side is to act, Next side and New round. New round asks who acts
 * first, and offers the Group Initiative Table (pinned in Rolls too), whose
 * roll answers it. Each seat and unit carries its Acted mark
 * (`PlayMediatorSeat`, `PlayNpcBox`); a pilot's fills when their turn ends.
 *
 * A tracker the Mediator moves (`lib/rules/initiative.ts`): nothing is
 * refused, no round ends and no side moves on its own. Give the turn still
 * works within a side.
 */

import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  Button,
  CHAPTER_BAND_COLOR,
  Segmented,
  SegmentedOption,
  Stat,
  Toggle,
  tokens,
} from '../../components/index'
import {
  firstSideOf,
  INITIATIVE_MODE,
  INITIATIVE_TABLE,
  newRound,
  nextSide,
  roundDone,
  sideFor,
} from '../../lib/rules/initiative'
import { mediatorCopy } from '../../messages/play-mediator'
import { PlayRollTable } from '../PlayRollTable'
import { recordPlayRoll } from '../playRolls.model'
import { mediatorSides } from './initiative.model'
import { NOTE, NOTE_MUTED } from './mediatorStyles.model'
import type { InitiativeTracker } from './useInitiative'
import type { PlayMediator } from './usePlayMediator'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

export function MediatorInitiative({
  mediator,
  tracker,
}: {
  mediator: PlayMediator
  tracker: InitiativeTracker
}) {
  const { initiative, set } = tracker
  const live = mediator.canWrite
  if (initiative === null) {
    return live ? (
      <div style={ROW}>
        <Button size="compact" onClick={() => set(newRound(null))}>
          {mediatorCopy('startGroupInitiative')}
        </Button>
      </div>
    ) : null
  }

  const sides = mediatorSides(mediator)
  const rounds = INITIATIVE_MODE === 'rounds'
  const current = sides.find((side) => side.id === initiative.side)
  const asking = rounds && initiative.side === undefined
  const table = asking ? SalvageUnionReference.RollTables.getByName(INITIATIVE_TABLE) : undefined
  const first = (answer: 'pilots' | 'opposition') =>
    set({ ...initiative, side: sideFor(answer, sides) })

  return (
    <section style={STACK} aria-label={mediatorCopy('groupInitiative')}>
      <div style={ROW}>
        {rounds && <Stat size="mini" label={mediatorCopy('round')} value={initiative.round} />}
        {current && <span style={NOTE}>{mediatorCopy('toAct', { side: current.name })}</span>}
      </div>
      {rounds && !asking && (
        <Segmented label={mediatorCopy('sides')} size="compact" wrap>
          {sides.map((side) => (
            <SegmentedOption
              key={side.id}
              pressed={side.id === initiative.side}
              disabled={!live}
              onClick={() => set({ ...initiative, side: side.id })}
            >
              {side.name}
            </SegmentedOption>
          ))}
        </Segmented>
      )}
      {asking && live && (
        <>
          <p style={NOTE_MUTED}>{mediatorCopy('whoActsFirst')}</p>
          <div style={ROW}>
            <Button size="compact" onClick={() => first('pilots')}>
              {mediatorCopy('pilotsFirst')}
            </Button>
            <Button size="compact" onClick={() => first('opposition')}>
              {mediatorCopy('oppositionFirst')}
            </Button>
          </div>
          {table && (
            <PlayRollTable
              table={table.table}
              name={table.name}
              size="mini"
              tone={CHAPTER_BAND_COLOR.rules}
              onRollResult={(text, _key, dice) => {
                recordPlayRoll({
                  tableName: table.name,
                  rolls: dice,
                  label: table.name,
                  outcome: text,
                })
                const [total] = dice
                if (total !== undefined) first(firstSideOf(total))
              }}
            />
          )}
        </>
      )}
      {roundDone(initiative, sides) && <p style={NOTE}>{mediatorCopy('everyoneHasActed')}</p>}
      {live && (
        <div style={ROW}>
          {rounds && !asking && (
            <Button
              size="compact"
              onClick={() => set({ ...initiative, side: nextSide(sides, initiative.side) })}
            >
              {mediatorCopy('nextSide')}
            </Button>
          )}
          <Button size="compact" onClick={() => set(newRound(initiative))}>
            {mediatorCopy('newRound')}
          </Button>
          <Button
            variant="ghost"
            size="compact"
            aria-label={mediatorCopy('endInitiativeLabel')}
            onClick={() => set(null)}
          >
            {mediatorCopy('endInitiative')}
          </Button>
        </div>
      )}
      <p style={NOTE_MUTED}>{mediatorCopy('initiativeNote')}</p>
    </section>
  )
}

/**
 * A seat's or a unit's Acted mark while the tracker is kept: the Mediator's
 * to fill or clear; read-only, the word alone.
 */
export function ActedMark({
  name,
  acted,
  onToggle,
}: {
  name: string
  acted: boolean
  onToggle?: (() => void) | undefined
}) {
  if (!onToggle) return acted ? <Stat size="mini" label={mediatorCopy('acted')} /> : null
  return (
    <Toggle
      size="mini"
      pressed={acted}
      glyph={acted ? '✓' : undefined}
      aria-label={mediatorCopy('actedFor', { name })}
      onClick={onToggle}
    >
      {acted ? mediatorCopy('acted') : mediatorCopy('notActed')}
    </Toggle>
  )
}
