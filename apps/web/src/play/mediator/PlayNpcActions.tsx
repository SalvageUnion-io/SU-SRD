/**
 * PlayNpcActions — the chosen NPC's actions under the Opposition (play.md
 * §10, wireframe pin 4), flattened like a player's list (`npcActions`, sorted
 * by action type): each a level-1 Row in the Actions column's own list
 * (`.su-play-act-list`), its chips in the shared stat order, cost last, with
 * Use, then the Morale check.
 *
 * Every roll here is a table's (`PlayRollInstrument`, R8): Use opens the
 * action's resolve in its Row, the NPC Action table, whose stamp is the roll
 * and whose marked row is what it came to (ruleset §1.4, as a player's
 * action resolves). Every roll goes on Play's roll log (`reportingRoll`),
 * which keeps the Mediator's rolls off the Game's log and posts one only when
 * the Post toggle or the roll's own Post says so. The Morale check is the
 * tray's own (`TrayWrites.morale`): the Morale table, open, its stamp the
 * roll, the NPC's last roll its marked row, kept on the NPC and in its box.
 */

import { useMemo, useState } from 'react'
import { resultForTable, SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Row } from '../../components/entity/forms/Row'
import { Button, EmptyState, rollForTable, Slab, TitledBox } from '../../components/index'
import { PlayRollInstrument } from '../PlayRollInstrument'
import { reportingRoll } from '../playRolls.model'
import type { NpcAction } from './npcActions.model'
import { npcActions } from './npcActions.model'
import type { TrayNpc } from './opposition.model'

/** The NPC Action table (Workshop Manual): what every NPC action's roll reads. */
const NPC_ACTION = 'NPC Action'

/** The table an NPC's Morale check reads. */
const MORALE = 'Morale'

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
  // The action resolving in its Row: one at a time, as a player's.
  const [open, setOpen] = useState<string | null>(null)
  const live = canWrite && !npc.down
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
            live={live}
            open={open === entry.key}
            onOpen={(on) => setOpen(on ? entry.key : null)}
            rollFor={rollFor}
          />
        ))}
        <li className="su-play-act" data-action-key="morale">
          <TitledBox title="Morale check" as="div">
            <PlayRollInstrument
              table={MORALE}
              roll={npc.lastRoll?.roll ?? null}
              onRoll={live ? onMorale : undefined}
            />
          </TitledBox>
        </li>
      </ul>
    </>
  )
}

function NpcActionRow({
  npc,
  entry,
  live,
  open,
  onOpen,
  rollFor,
}: {
  npc: TrayNpc
  entry: NpcAction
  live: boolean
  open: boolean
  onOpen: (open: boolean) => void
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
    <li className="su-play-act" data-open={open || undefined} data-action-key={entry.key}>
      <Row
        model={model}
        omit={['art']}
        slots={{
          controls: open ? (
            <Button
              size="mini"
              aria-label={`Cancel ${entry.name} for ${npc.name}`}
              onClick={() => {
                setRolled(null)
                onOpen(false)
              }}
            >
              Cancel
            </Button>
          ) : (
            <Button
              size="mini"
              disabled={!live}
              aria-label={`Use ${entry.name} for ${npc.name}`}
              onClick={() => onOpen(true)}
            >
              Use
            </Button>
          ),
          ...(open
            ? {
                leading: (
                  <div className="su-play-resolve">
                    <PlayRollInstrument
                      table={NPC_ACTION}
                      roll={rolled?.die ?? null}
                      onRoll={live ? () => void roll() : undefined}
                    />
                    {rolled ? (
                      <p className="su-play-resolve__note" aria-live="polite">
                        {rolled.die} · {rolled.band}
                      </p>
                    ) : null}
                  </div>
                ),
              }
            : {}),
        }}
      />
    </li>
  )
}
