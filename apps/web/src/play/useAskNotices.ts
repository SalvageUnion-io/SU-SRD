/**
 * useAskNotices — the rolls the Mediator asked of the viewer's seats
 * (ADR-068 §4), as strip notices: one press rolls the table where Play shows
 * it and answers the ask; off Play, the way to that seat's table.
 */

import { cockpitPath } from 'game-domain/entityKinds'
import { useServerAction } from '../lib/connection/useServerAction'
import { playDoorCopy } from '../messages/play-door'
import { momentCopy } from '../messages/play-moment'
import { useTableAct } from '../replica/useTable'
import type { RollAsk } from '../rooms/game/scene'
import type { Notice } from './TableNoticeStack'
import { askNotice } from './tableNotices.model'
import { askPlayTable, playTablesShown } from './zeroVital.model'

export function useAskNotices(
  gameId: string,
  asks: readonly RollAsk[] | undefined,
  canWrite: boolean
): Notice[] {
  const answer = useServerAction(useTableAct('scenes.answerAsk', gameId), {
    failure: momentCopy('askDidNotLand'),
    toastId: 'table-answer-ask',
  })
  return (asks ?? []).map((ask) => {
    if (!playTablesShown()) {
      return askNotice(ask, { href: cockpitPath(ask.pilotId), label: playDoorCopy('openTable') })
    }
    const roll = () => {
      askPlayTable(ask.table, true)
      void answer.run({ pilotId: ask.pilotId })
    }
    return askNotice(ask, { roll, pending: answer.pending || !canWrite })
  })
}
