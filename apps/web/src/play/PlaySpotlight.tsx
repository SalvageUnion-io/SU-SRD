/**
 * PlaySpotlight — what the Mediator put on the table (ADR-068 §4), on every
 * seat's Moment while it has no beat of its own: an NPC by its name and kind
 * (all the room serves of it), or a roll table, whole and read-only. It
 * heads the Ready list, never replaces it, and goes when the Mediator clears it.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import {
  digestColumnsTable,
  digestRollTable,
  RollTableInstrument,
  Stat,
  TraitProse,
} from '../components/index'
import { schemaLabel } from '../lib/schemaLabels'
import { momentCopy } from '../messages/play-moment'
import type { OnTable } from '../rooms/game/scene'
import { PlayMoment } from './PlayMoment'

export function PlaySpotlight({ spot }: { spot: OnTable }) {
  if (spot.kind === 'npc') {
    const kind = schemaLabel(spot.refSchema)
    return (
      <PlayMoment
        title={spot.name}
        tone="adversary"
        chips={<Stat size="mini" label={kind} />}
        actionKey="on-the-table"
        table
      >
        <p className="su-play-moment__note" role="status">
          {momentCopy('npcOnTable')}
        </p>
      </PlayMoment>
    )
  }
  const found = SalvageUnionReference.RollTables.getByName(spot.name)
  if (found === undefined) return null
  const { table } = found
  return (
    <PlayMoment title={found.name} tone="ink" actionKey="on-the-table" table>
      <p className="su-play-moment__note" role="status">
        {momentCopy('tableOnTable')}
      </p>
      <RollTableInstrument
        name={found.name}
        size="mini"
        frame="rule"
        off={momentCopy('rollFromRolls')}
        table={
          table.type === 'columns'
            ? { kind: 'columns', columns: digestColumnsTable(table) }
            : {
                kind: 'bands',
                rows: digestRollTable(table).map((row) => ({
                  ...row,
                  value: <TraitProse text={row.value} />,
                })),
              }
        }
      />
    </PlayMoment>
  )
}
