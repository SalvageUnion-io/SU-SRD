/**
 * PlayNpcActions — the chosen NPC's actions under the Opposition (play.md
 * §10), flattened like a player's list (`npcActions`, sorted
 * by action type): each a Mini one a line in the Actions column's own list
 * (ruleset §1.3, Play's lists are Minis), its chips in
 * the shared stat order, cost last, with Use after it (C8), then the Morale
 * check.
 *
 * Every roll here is a table's (`PlayRollInstrument`, R8): Use opens the
 * action's resolve as its Mini's contentful body (N3, plain content), the
 * NPC Action table, whose stamp is the roll
 * and whose marked row is what it came to (ruleset §1.4, as a player's
 * action resolves). Every roll goes on Play's roll log (`reportingRoll`),
 * which writes each to the Game's log and posts it to the
 * bound Discord channel. The Morale check is the
 * tray's own (`TrayWrites.morale`): the Morale table, open, its stamp the
 * roll, the NPC's last roll its marked row, kept on the NPC and in its box.
 *
 * A weapon's roll offers its hit (r4 D2): "Propose 3 HP to…" lists the seats
 * that take that damage (`hitTargets`), and pressing one sends the proposal,
 * the weapon its reason. The Mediator decides whether it hit; the player
 * still decides whether it applies.
 */

import type { ProposalTarget } from 'game-domain/games/proposals'
import { PROPOSAL_REASON_MAX } from 'game-domain/games/proposals'
import { useMemo, useState } from 'react'
import { resultForTable, SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import {
  Button,
  EmptyState,
  Entity,
  HeaderMenu,
  rollForTable,
  Slab,
  TraitProse,
  toast,
} from '../../components/index'
import { actionEffect } from '../../lib/rules/actionEffect'
import { mediatorCopy } from '../../messages/play-mediator'
import { PlayRollInstrument } from '../PlayRollInstrument'
import { playLineModel } from '../playLine.model'
import { reportingRoll } from '../playRolls.model'
import { usePlayWide } from '../usePlayWide'
import type { NpcAction } from './npcActions.model'
import { npcActions } from './npcActions.model'
import type { TrayNpc } from './opposition.model'
import type { ProposeArgs } from './ProposeDock'
import type { HitDamage } from './proposalLine.model'
import { hitDamageOf, hitTargets } from './proposalLine.model'

/** Where a weapon's hit goes: the seats a proposal can reach, and the write. */
export type NpcHit = {
  targets: readonly ProposalTarget[]
  /** Resolves when the server has the proposal; rejects with its refusal, already said. */
  onPropose: (args: ProposeArgs) => Promise<void>
}

/** The NPC Action table (Workshop Manual): what every NPC action's roll reads. */
const NPC_ACTION = 'NPC Action'

/** The table an NPC's Morale check reads. */
const MORALE = 'Morale'

const MORALE_CHECK = playLineModel({ name: mediatorCopy('moraleCheck'), key: 'morale' })

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
  /** Where a weapon's hit can be proposed; absent, a roll offers nothing. */
  hit?: NpcHit | undefined
  /** The dice (a test injects its own). */
  rollFor?: typeof rollForTable | undefined
}

export function PlayNpcActions({
  npc,
  canWrite,
  onMorale,
  hit,
  rollFor = rollForTable,
}: PlayNpcActionsProps) {
  const actions = useMemo(() => npcActions(npc), [npc])
  // The action resolving in its Mini: one at a time, as a player's.
  const [open, setOpen] = useState<string | null>(null)
  const live = canWrite && !npc.down
  return (
    <>
      <Slab as="h3" label={mediatorCopy('actions', { name: npc.name })} />
      {actions.length === 0 ? (
        <EmptyState variant="inline" body={mediatorCopy('theReferenceGivesItNo')} />
      ) : null}
      <ul
        className="su-entity-mini-list"
        aria-label={mediatorCopy('sActions', { name: npc.name })}
        data-play-list=""
      >
        {actions.map((entry) => (
          <NpcActionRow
            key={entry.key}
            npc={npc}
            entry={entry}
            live={live}
            open={open === entry.key}
            onOpen={(on) => setOpen(on ? entry.key : null)}
            hit={live ? hit : undefined}
            rollFor={rollFor}
          />
        ))}
        <li className="su-play-act" data-action-key="morale">
          <Entity
            size="mini"
            context="play"
            model={MORALE_CHECK}
            body={{
              text: false,
              children: (
                <PlayRollInstrument
                  table={MORALE}
                  roll={npc.lastRoll?.roll ?? null}
                  onRoll={live ? onMorale : undefined}
                />
              ),
            }}
          />
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
  hit,
  rollFor,
}: {
  npc: TrayNpc
  entry: NpcAction
  live: boolean
  open: boolean
  onOpen: (open: boolean) => void
  hit: NpcHit | undefined
  rollFor: typeof rollForTable
}) {
  // The same row text as the player's board: the effect alone.
  const effect = useMemo(() => actionEffect(entry.action), [entry.action])
  const model = useMemo(
    () => ({ ...toEntityModel(entry.action), prose: effect }),
    [entry.action, effect]
  )
  const first = effect.find((block) => typeof block.value === 'string')?.value
  const wide = usePlayWide()
  const [rolled, setRolled] = useState<{ die: number; band: string } | null>(null)
  const damage = useMemo(() => hitDamageOf(entry.action), [entry.action])

  async function roll() {
    let said: string | undefined
    const die = reportingRoll(await rollFor(NPC_ACTION), NPC_ACTION, () => ({
      label: `${npc.name} · ${entry.name}`,
      veiled: true as const,
      ...(said ? { outcome: said } : {}),
    }))(20)
    said = npcActionOutcome(die) || undefined
    setRolled({ die, band: said ?? '' })
  }

  return (
    <li className="su-play-act" data-open={open || undefined} data-action-key={entry.key}>
      <Entity
        size="mini"
        context="play"
        model={model}
        controls={
          open ? (
            <Button
              size="mini"
              aria-label={mediatorCopy('cancelFor', { name: entry.name, name2: npc.name })}
              onClick={() => {
                setRolled(null)
                onOpen(false)
              }}
            >
              {mediatorCopy('cancel')}
            </Button>
          ) : (
            <Button
              // Every Use is rust; a phone's is a 44px target.
              size={wide ? 'mini' : 'full'}
              variant="primary"
              disabled={!live}
              aria-label={mediatorCopy('useFor', { name: entry.name, name2: npc.name })}
              onClick={() => onOpen(true)}
            >
              {mediatorCopy('use')}
            </Button>
          )
        }
        {...(open
          ? {
              body: {
                children: (
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
                    {rolled && damage && hit ? (
                      <HitOffer npc={npc} weapon={entry.name} damage={damage} hit={hit} />
                    ) : null}
                  </div>
                ),
              },
            }
          : typeof first === 'string'
            ? {
                body: {
                  text: false,
                  children: <TraitProse as="p" className="su-play-act__effect" text={first} />,
                },
              }
            : {})}
      />
    </li>
  )
}

/**
 * A rolled weapon's hit, two presses from its target (r4 D2): the button
 * names the damage, its menu the seats that take it and what each is left
 * with; a seat pressed is proposed it at once.
 */
function HitOffer({
  npc,
  weapon,
  damage,
  hit,
}: {
  npc: TrayNpc
  weapon: string
  damage: HitDamage
  hit: NpcHit
}) {
  const unit = damage.damageType
  const seats = hitTargets(damage, hit.targets)
  if (seats.length === 0) {
    return <p className="su-play-resolve__note">{mediatorCopy('noOneToHit', { unit })}</p>
  }
  return (
    <HeaderMenu
      variant="button"
      size="compact"
      trigger={mediatorCopy('proposeHitTo', { amount: damage.amount, unit })}
      label={mediatorCopy('proposeHitFor', { amount: damage.amount, unit, name: npc.name })}
      sections={[
        seats.map(({ target, field, before, after }) => ({
          id: target.id,
          label: target.label,
          hint: mediatorCopy('hitLeaves', { unit, before, after }),
          onSelect: () =>
            void hit
              .onPropose({
                entityId: target.id,
                entityType: target.kind,
                field,
                after,
                reason: `${npc.name} · ${weapon}`.slice(0, PROPOSAL_REASON_MAX),
              })
              .then(() =>
                toast.success(
                  mediatorCopy('hitProposed', { name: target.label, unit, before, after })
                )
              )
              // The caller has already said why.
              .catch(() => undefined),
        })),
      ]}
    />
  )
}
