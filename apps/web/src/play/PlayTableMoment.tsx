/**
 * PlayTableMoment — the Table's Moment (ADR-068 §3): with no beat of your
 * own, the beat another seat has in play, from its Activate to its Apply, on
 * the Moment's frame in their colour, read-only. It heads the Ready list and
 * never replaces it: browsing stays yours. What it shows is what the seat
 * shares (`SeatResolving`): the action's name, its steps, its roll.
 */

import { coreRollBandLabel } from 'salvageunion-reference/rules'
import { Stat } from '../components/index'
import { momentCopy } from '../messages/play-moment'
import type { TableBeat } from './moment.model'
import { tableTrack } from './moment.model'
import { PlayMoment } from './PlayMoment'

export function PlayTableMoment({ beat }: { beat: TableBeat }) {
  const { resolving } = beat
  const roll = resolving.roll ?? null
  const salvage = resolving.salvage ?? null
  return (
    <PlayMoment
      title={resolving.name}
      tone={beat.boarded ? 'mech' : 'pilot'}
      chips={<Stat size="mini" label={beat.pilot} />}
      track={tableTrack(resolving)}
      actionKey={`table-${beat.pilotId}`}
      table
    >
      <div className="su-play-moment__table" role="status">
        <p>{momentCopy('tableSays', { pilot: beat.pilot })}</p>
        {roll === null ? null : (
          <Stat
            size="mini"
            label={momentCopy('roll')}
            value={`${roll.roll} · ${coreRollBandLabel(roll.band)}`}
          />
        )}
        {salvage === null ? null : (
          <Stat size="mini" label={momentCopy('roll')} value={String(salvage.roll)} />
        )}
      </div>
    </PlayMoment>
  )
}
