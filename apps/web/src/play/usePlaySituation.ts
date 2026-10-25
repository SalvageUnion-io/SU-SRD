/**
 * usePlaySituation — the pilot's play as the whole Cockpit reads it
 * (play.md §3): the seat (`useSeatAt`), the Downtime (`usePlayDowntime`),
 * the Situation they make, the mechs Board offers and the writes that change
 * the Situation. `PlayCockpit` calls it once and hands the `Play` object to
 * the Situation switch and to every column, so all of them agree.
 *
 * On foot and Boarded write the seat's mount; Downtime, while it runs, wins
 * over the mount (`situationOf`). Only solo play or the Game's Mediator may
 * start and end Downtime (`canChangeDowntime`); the server refuses anyone
 * else whatever this says.
 */

import type { Id } from '../../convex/_generated/dataModel'
import { useConnection } from '../lib/connection/connectionContext'
import { useEntityStore } from '../stores/entityStore'
import { boardMenu } from './boardMenu.model'
import type { PlayTarget } from './play.model'
import { playReadOnly } from './play.model'
import type { Play } from './situation.model'
import { situationOf, soloMechOptions } from './situation.model'
import { useGameBoardSources } from './useBoardSources'
import { usePlayDowntime } from './usePlayDowntime'
import { useScene } from './useScene'
import { useSeatAt } from './useSeat'

export function usePlaySituation(target: PlayTarget): Play {
  const connection = useConnection()
  const { canWrite } = connection
  const store = useEntityStore()
  const pilot = store.get('pilot', target.pilotId)
  const seat = useSeatAt({ gameId: target.gameId as Id<'games'> | null, pilotId: target.pilotId })
  const downtime = usePlayDowntime(target)
  const scene = useScene(target.gameId)
  const sources = useGameBoardSources(target.gameId as Id<'games'> | null)

  const mount = seat.seat.mount
  const boardedMechId = mount.kind === 'boarded' ? mount.mechId : null

  const assignedId =
    store.softLinks.find((l) => l.type === 'mech-to-pilot' && l.to.id === target.pilotId)?.from
      .id ?? null
  const assigned = assignedId === null ? null : store.get('mech', assignedId)
  const mechs =
    target.gameId === null
      ? soloMechOptions(target.pilotId, store.list('mech'), store.softLinks)
      : boardMenu({ pilotId: target.pilotId, assigned, sources })

  const canChangeDowntime = target.gameId === null || target.mediator

  return {
    target,
    pilot,
    situation: situationOf(downtime.downtime.running, mount),
    boardedMech: boardedMechId === null ? null : store.get('mech', boardedMechId),
    boardedMechId,
    mechs,
    setOnFoot: () => {
      if (mount.kind === 'boarded') seat.dismount()
    },
    board: (mechId) => {
      if (mechId !== boardedMechId) seat.board(mechId)
    },
    assignAndBoard: (option) => {
      if (option.serverId !== null) {
        seat.assignAndBoard({ mechId: option.mechId, serverId: option.serverId })
      }
    },
    canChangeDowntime,
    startDowntime: () => {
      if (canChangeDowntime && !downtime.downtime.running) downtime.begin()
    },
    endDowntime: () => {
      if (canChangeDowntime && downtime.downtime.running) downtime.end()
    },
    seat,
    downtime,
    scene,
    canWrite,
    readOnly: playReadOnly(connection),
  }
}
