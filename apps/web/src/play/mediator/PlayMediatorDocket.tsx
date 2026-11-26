/**
 * PlayMediatorDocket — the Mediator's Docket (ADR-068 §5), heading the
 * Opposition: what the table waits on, one ticket a line, taken in any
 * order (`docketOf`). Morale due and To act open that NPC's box; Asked has
 * Withdraw; Awaiting answer and a seat's Heat Check only say so. With
 * nothing waiting it takes no room.
 */

import type { CSSProperties } from 'react'
import { Button, SlabSection, Stat, tokens } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { flagOn } from '../../lib/flags'
import { momentCopy } from '../../messages/play-moment'
import { useTableAct } from '../../replica/useTable'
import type { DocketTicket } from './docket.model'
import { docketOf } from './docket.model'
import type { PlayMediator } from './usePlayMediator'

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  justifyContent: 'space-between',
} satisfies CSSProperties

function labelOf(kind: DocketTicket['kind']): string {
  switch (kind) {
    case 'morale':
      return momentCopy('moraleDue')
    case 'toAct':
      return momentCopy('toAct')
    case 'awaiting':
      return momentCopy('awaitingAnswer')
    case 'owes':
      return momentCopy('owesHeatCheck')
    case 'asked':
      return momentCopy('askedToRoll')
  }
}

function ticketText(ticket: DocketTicket): string {
  switch (ticket.kind) {
    case 'morale':
    case 'toAct':
      return ticket.name
    case 'awaiting':
      return ticket.line
    case 'owes':
      return ticket.seat
    case 'asked':
      return `${ticket.seat} · ${ticket.table}`
  }
}

/** The Docket of the Mediator's screen: its tickets, and Withdraw on an ask. */
export function PlayMediatorDocket({
  mediator,
  acted,
  onOpen,
}: {
  mediator: PlayMediator
  /** Who has acted this round; null while no Group Initiative is kept. */
  acted: readonly string[] | null
  onOpen: (npcId: string) => void
}) {
  const ask = useServerAction(useTableAct('scenes.askRoll', mediator.gameId), {
    failure: momentCopy('askDidNotLand'),
    toastId: 'table-ask',
  })
  const tickets = docketOf({
    npcs: mediator.npcs ?? [],
    acted,
    sent: mediator.sent ?? [],
    crew: mediator.crew,
    seats: mediator.seats,
    asks: mediator.scene.asks ?? [],
    grouping: flagOn('encounterSheet'),
  })
  return (
    <DocketList
      tickets={tickets}
      canWrite={mediator.canWrite && !ask.pending}
      onOpen={onOpen}
      onWithdraw={(pilotId) => void ask.run({ pilotId, table: null })}
    />
  )
}

function DocketList({
  tickets,
  canWrite,
  onOpen,
  onWithdraw,
}: {
  tickets: readonly DocketTicket[]
  canWrite: boolean
  /** Open an NPC's box, and bring it on screen. */
  onOpen: (npcId: string) => void
  /** Take back the roll asked of a seat. */
  onWithdraw: (pilotId: string) => void
}) {
  if (tickets.length === 0) return null
  return (
    <SlabSection
      as="h2"
      id="mediate-docket"
      title={momentCopy('docket')}
      actions={<Stat size="compact" label={String(tickets.length)} />}
    >
      <ul style={LIST}>
        {tickets.map((ticket) => (
          <li key={ticket.key} style={ROW}>
            <Stat
              size="mini"
              label={labelOf(ticket.kind)}
              value={ticketText(ticket)}
              state={ticket.kind === 'morale' || ticket.kind === 'owes' ? 'caution' : undefined}
            />
            {ticket.kind === 'morale' || ticket.kind === 'toAct' ? (
              <Button
                size="mini"
                aria-label={momentCopy('openNamed', { name: ticket.name })}
                onClick={() => onOpen(ticket.npcId)}
              >
                {momentCopy('open')}
              </Button>
            ) : ticket.kind === 'asked' ? (
              <Button
                size="mini"
                disabled={!canWrite}
                aria-label={momentCopy('withdrawAskOf', { seat: ticket.seat })}
                onClick={() => onWithdraw(ticket.pilotId)}
              >
                {momentCopy('withdraw')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </SlabSection>
  )
}
