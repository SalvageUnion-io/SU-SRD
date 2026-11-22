/**
 * useSituationMoves — what a change of Situation does (play.md §3), for
 * whichever control asks: the bar's `PlaySituationSwitch` from `lg`, the ⋯
 * rows below it (`situationRows`). `go` climbs out or boards, behind the End
 * Downtime confirm while a Downtime this screen may end is running, and
 * behind the assign confirm for an unassigned spare. `dialogs` is those two
 * confirms; the caller renders it once.
 */

import { downtimeStepCount } from 'game-domain/rules/downtime'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { ConfirmDialog } from '../components/app'
import type { HeaderMenuItem } from '../components/index'
import { playCopy } from '../messages/play'
import { AssignAndBoardConfirm } from './AssignAndBoardConfirm'
import type { BoardOption } from './boardMenu.model'
import { boardable } from './boardMenu.model'
import type { Play } from './situation.model'

type SituationMove = { kind: 'foot' } | { kind: 'board'; option: BoardOption }

type SituationMoves = {
  go: (to: SituationMove) => void
  dialogs: ReactNode
}

export function useSituationMoves(play: Play): SituationMoves {
  const [leaving, setLeaving] = useState<SituationMove | null>(null)
  const [assigning, setAssigning] = useState<BoardOption | null>(null)
  const { downtime } = play.downtime

  function arrive(to: SituationMove) {
    if (to.kind === 'foot') play.setOnFoot()
    else if (to.option.state === 'spare') setAssigning(to.option)
    else play.board(to.option.mechId)
  }

  /** Go there now, or once a running Downtime this screen may end is ended. */
  function go(to: SituationMove) {
    if (downtime.running && play.canChangeDowntime) {
      setLeaving(to)
      return
    }
    arrive(to)
  }

  return {
    go,
    dialogs: (
      <>
        <ConfirmDialog
          open={leaving !== null}
          onOpenChange={(open) => {
            if (!open) setLeaving(null)
          }}
          tone="danger"
          title={playCopy('endDowntime2')}
          body={endDowntimeBody(downtime.stepIndex, play.target.gameId !== null)}
          confirmLabel={playCopy('endDowntime')}
          onConfirm={() => {
            const to = leaving
            play.endDowntime()
            setLeaving(null)
            if (to !== null) arrive(to)
          }}
        />
        <AssignAndBoardConfirm
          play={play}
          assigning={assigning}
          onClose={() => setAssigning(null)}
        />
      </>
    ),
  }
}

/** What ending a running Downtime early costs, as the confirm says it. */
function endDowntimeBody(stepIndex: number | null, inGame: boolean): string {
  return playCopy(inGame ? 'endDowntimeBodyGame' : 'endDowntimeBodySolo', {
    step: (stepIndex ?? 0) + 1,
    count: downtimeStepCount(),
  })
}

/**
 * The Situation as ⋯ rows below `lg`: On foot, a row for each mech that can
 * be boarded, Downtime, then Table mode. The row that is so now says "Now"
 * and does nothing. Downtime is the Mediator's in a Game, so a player's row
 * there only reads; every move is off while writes cannot go.
 */
export function situationRows({
  play,
  moves,
  tableOn,
  setTableOn,
}: {
  play: Play
  moves: SituationMoves
  tableOn: boolean
  setTableOn: (on: boolean) => void
}): HeaderMenuItem[] {
  const { situation, canWrite, canChangeDowntime } = play
  const { downtime, locked } = play.downtime
  const now = playCopy('now')
  const boardedId = situation === 'boarded' ? (play.boardedMech?.id ?? null) : null
  return [
    {
      id: 'on-foot',
      label: playCopy('onFoot'),
      hint: situation === 'onFoot' ? now : undefined,
      onSelect: !canWrite || situation === 'onFoot' ? undefined : () => moves.go({ kind: 'foot' }),
    },
    ...play.mechs.filter(boardable).map((option) => ({
      id: `board-${option.mechId}`,
      label: playCopy(option.state === 'spare' ? 'assignAndBoardName' : 'boardName', {
        name: option.name,
      }),
      hint: boardedId === option.mechId ? now : (option.note ?? undefined),
      onSelect:
        !canWrite || boardedId === option.mechId
          ? undefined
          : () => moves.go({ kind: 'board', option }),
    })),
    {
      id: 'downtime',
      label: playCopy('downtimeWord'),
      hint: downtime.running ? now : locked ? playCopy('setByTheMediator') : undefined,
      onSelect:
        canWrite && canChangeDowntime && !downtime.running ? () => play.startDowntime() : undefined,
    },
    {
      id: 'table-mode',
      label: playCopy(tableOn ? 'leaveTableMode' : 'tableMode'),
      // What it is, said once: the row was unexplained (SB4-08).
      hint: tableOn ? undefined : playCopy('tableModeHint'),
      onSelect: () => setTableOn(!tableOn),
    },
  ]
}
