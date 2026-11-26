/**
 * PutOnTheTable — what the Mediator shares with every seat (ADR-068 §4),
 * from the Play bar's ⋯: one thing on the table at a time, a tray NPC (the
 * room keeps its name and kind alone) or a roll table, with Clear; a roll
 * asked of one seat, a ticket on that seat's strip; and Hold, a word on
 * every seat's strip. Each seat sees what is on the table on its
 * Moment while it has no beat of its own (`PlaySpotlight`).
 */

import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Button, EmptyState, Eyebrow, Field, Select, Toggle, tokens } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { momentCopy } from '../../messages/play-moment'
import { useTableAct } from '../../replica/useTable'
import type { PlayMediator } from './usePlayMediator'

const { space } = tokens

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  padding: space[12],
} satisfies CSSProperties

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
  justifyContent: 'space-between',
} satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

export function PutOnTheTable({ mediator }: { mediator: PlayMediator }) {
  const id = useId()
  const { gameId, canWrite, scene } = mediator
  const put = useServerAction(useTableAct('scenes.putOnTable', gameId), {
    failure: momentCopy('putDidNotLand'),
    toastId: 'table-put',
  })
  const hold = useServerAction(useTableAct('scenes.hold', gameId), {
    failure: momentCopy('putDidNotLand'),
    toastId: 'table-hold',
  })
  const ask = useServerAction(useTableAct('scenes.askRoll', gameId), {
    failure: momentCopy('askDidNotLand'),
    toastId: 'table-ask',
  })
  const tables = SalvageUnionReference.RollTables.all()
  const [table, setTable] = useState(tables[0]?.name ?? '')
  const seats = mediator.seats
  const [seatId, setSeatId] = useState<string | null>(null)
  const seat = seats.find((s) => s.pilotId === seatId) ?? seats[0] ?? null
  const [asked, setAsked] = useState(tables[0]?.name ?? '')
  const off = !canWrite || put.pending
  const onTable = scene.onTable ?? null
  const npcs = mediator.npcs ?? []

  return (
    <div style={STACK}>
      <div style={ROW}>
        <Eyebrow tone="muted">
          {onTable === null
            ? momentCopy('nothingOnTable')
            : momentCopy('onTableNow', { name: onTable.name })}
        </Eyebrow>
        {onTable !== null && (
          <Button size="compact" disabled={off} onClick={() => void put.run({ put: null })}>
            {momentCopy('clear')}
          </Button>
        )}
      </div>
      <section aria-label={momentCopy('revealAnNpc')}>
        <Eyebrow tone="muted">{momentCopy('revealAnNpc')}</Eyebrow>
        {npcs.length === 0 ? (
          <EmptyState variant="inline" body={momentCopy('noNpcToReveal')} />
        ) : (
          <ul style={LIST}>
            {npcs.map((npc) => (
              <li key={npc.id} style={ROW}>
                <span>{npc.name}</span>
                <Button
                  size="compact"
                  disabled={off}
                  aria-label={momentCopy('showNamed', { name: npc.name })}
                  onClick={() => void put.run({ put: { kind: 'npc', npcId: npc.id } })}
                >
                  {momentCopy('show')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div style={ROW}>
        <Field label={momentCopy('aRollTable')} htmlFor={`${id}-table`}>
          <Select id={`${id}-table`} value={table} onChange={(e) => setTable(e.target.value)}>
            {tables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          size="compact"
          disabled={off || table === ''}
          aria-label={momentCopy('showNamed', { name: table })}
          onClick={() => void put.run({ put: { kind: 'table', name: table } })}
        >
          {momentCopy('show')}
        </Button>
      </div>
      <section aria-label={momentCopy('askASeat')}>
        <Eyebrow tone="muted">{momentCopy('askASeat')}</Eyebrow>
        {seat === null ? (
          <EmptyState variant="inline" body={momentCopy('noSeatToAsk')} />
        ) : (
          <div style={ROW}>
            <Field label={momentCopy('aSeat')} htmlFor={`${id}-seat`}>
              <Select
                id={`${id}-seat`}
                value={seat.pilotId}
                onChange={(e) => setSeatId(e.target.value)}
              >
                {seats.map((s) => (
                  <option key={s.pilotId} value={s.pilotId}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={momentCopy('aRollTable')} htmlFor={`${id}-ask`}>
              <Select id={`${id}-ask`} value={asked} onChange={(e) => setAsked(e.target.value)}>
                {tables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              size="compact"
              disabled={!canWrite || ask.pending || asked === ''}
              aria-label={momentCopy('askNamed', { seat: seat.name, table: asked })}
              onClick={() => void ask.run({ pilotId: seat.pilotId, table: asked })}
            >
              {momentCopy('ask')}
            </Button>
          </div>
        )}
      </section>
      <div>
        <Toggle
          size="mini"
          pressed={scene.hold === true}
          disabled={!canWrite || hold.pending}
          onClick={() => void hold.run({ hold: scene.hold !== true })}
        >
          {momentCopy('holdTheTable')}
        </Toggle>
      </div>
    </div>
  )
}
