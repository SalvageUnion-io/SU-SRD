/**
 * PlayNpcActions — the chosen NPC's actions under the Opposition (play.md
 * §10, wireframe pin 4), flattened like a player's list (`npcActions`, sorted
 * by action type): each a level-1 Row in the Actions column's own list
 * (`.su-play-act-list`), its chips in the shared stat order, cost last, with
 * Roll, then the Morale check.
 *
 * Roll is a d20 on the NPC Action table for that action, its row said under
 * the Row (plain content, level 2). Every roll goes on Play's roll log
 * (`reportingRoll`), which keeps the Mediator's rolls off the Game's log and
 * posts one only when the Post toggle or the roll's own Post says so.
 * The Morale check is the tray's own (`TrayWrites.morale`): a d20 on the
 * Morale table, kept on the NPC and shown in its box.
 */

import { useMemo, useState } from 'react'
import { resultForTable, SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Row } from '../../components/entity/forms/Row'
import { Button, EmptyState, rollForTable, Slab, TitledBox } from '../../components/index'
import { reportingRoll } from '../playRolls.model'
import type { NpcAction } from './npcActions.model'
import { npcActions } from './npcActions.model'
import type { TrayNpc } from './opposition.model'

/** The NPC Action table (Workshop Manual): what every NPC action's Roll reads. */
const NPC_ACTION = 'NPC Action'

/** The row a die lands on, by its label ("Success"). */
function npcActionOutcome(die: number): string {
  const row = resultForTable(SalvageUnionReference.RollTables.getByName(NPC_ACTION)?.table, die)
  return row.success ? (row.result.label ?? row.result.value) : ''
}

type PlayNpcActionsProps = {
  npc: TrayNpc
  canWrite: boolean
  /** The NPC's Morale check: the tray's write. */
  onMorale: () => void
  /** The dice (a test injects its own). */
  rollFor?: typeof rollForTable
}

export function PlayNpcActions({
  npc,
  canWrite,
  onMorale,
  rollFor = rollForTable,
}: PlayNpcActionsProps) {
  const actions = useMemo(() => npcActions(npc), [npc])
  return (
    <>
      <Slab as="h3" label={`${npc.name} · Actions`} />
      {actions.length === 0 ? (
        <EmptyState variant="inline" body="The reference gives it no actions." />
      ) : null}
      <ul className="su-play-act-list" aria-label={`${npc.name}’s actions`}>
        {actions.map((entry) => (
          <NpcActionRow
            key={entry.key}
            npc={npc}
            entry={entry}
            canWrite={canWrite}
            rollFor={rollFor}
          />
        ))}
        <li className="su-play-act" data-action-key="morale">
          <TitledBox
            title="Morale check"
            as="div"
            controls={
              <Button
                size="mini"
                disabled={!canWrite || npc.down}
                aria-label={`Roll Morale for ${npc.name}`}
                onClick={onMorale}
              >
                Roll
              </Button>
            }
          >
            {null}
          </TitledBox>
        </li>
      </ul>
    </>
  )
}

function NpcActionRow({
  npc,
  entry,
  canWrite,
  rollFor,
}: {
  npc: TrayNpc
  entry: NpcAction
  canWrite: boolean
  rollFor: typeof rollForTable
}) {
  const model = useMemo(() => toEntityModel(entry.action), [entry.action])
  const [rolled, setRolled] = useState<{ die: number; band: string } | null>(null)

  async function roll() {
    let said: string | undefined
    const die = reportingRoll(await rollFor(NPC_ACTION), NPC_ACTION, () => ({
      label: `${npc.name} · ${entry.name}`,
      ...(said ? { outcome: said } : {}),
    }))(20)
    said = npcActionOutcome(die) || undefined
    setRolled({ die, band: said ?? '' })
  }

  return (
    <li className="su-play-act" data-action-key={entry.key}>
      <Row
        model={model}
        omit={['art']}
        slots={{
          controls: (
            <Button
              size="mini"
              disabled={!canWrite || npc.down}
              aria-label={`Roll ${entry.name} for ${npc.name}`}
              onClick={() => void roll()}
            >
              Roll
            </Button>
          ),
          ...(rolled
            ? {
                leading: (
                  <p className="su-play-resolve__note" aria-live="polite">
                    {rolled.die} · {rolled.band}
                  </p>
                ),
              }
            : {}),
        }}
      />
    </li>
  )
}
