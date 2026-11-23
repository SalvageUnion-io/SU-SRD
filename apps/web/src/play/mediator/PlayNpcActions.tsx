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
 * A weapon's roll offers its hit (r4 D2), beside the result at the top of the
 * resolve, above the table (r5 B6): "Propose 3 HP to…" lists the seats
 * that take that damage (`hitTargets`), and pressing one sends the proposal,
 * the table its reason, never the NPC (r7 C7). Nothing is offered on the table's Failure rows, a
 * miss; the player still decides whether a proposal applies.
 */

import type { ProposalTarget } from 'game-domain/games/proposals'
import { PROPOSAL_REASON_MAX } from 'game-domain/games/proposals'
import type { CSSProperties } from 'react'
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
  tokens,
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
import { hitDamageOf, hitTargets, veiledReason } from './proposalLine.model'

/** Where a weapon's hit goes: the seats a proposal can reach, and the write. */
export type NpcHit = {
  targets: readonly ProposalTarget[]
  /** Resolves when the server has the proposal; rejects with its refusal, already said. */
  onPropose: (args: ProposeArgs) => Promise<void>
}

/** How the book names the owning chassis in its abilities' text. */
const CHASSIS_TOKEN = '[(CHASSIS)]'

/** A roll's result and its hit, on one line that wraps. */
const RESULT = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

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

/** The table's own word for a miss: its Failure rows ("a weapon attack misses"). */
const missed = (band: string) => /failure/i.test(band)

type PlayNpcActionsProps = {
  npc: TrayNpc
  canWrite: boolean
  /** The NPC's Morale check: the tray's write. */
  onMorale: () => void
  /** Where a weapon's hit can be proposed; absent, a roll offers nothing. */
  hit?: NpcHit | undefined
  /** The dice (a test injects its own). */
  rollFor?: typeof rollForTable | undefined
  /** An action was rolled: the unit has taken its turn (r7 C3). */
  onActed?: (() => void) | undefined
}

export function PlayNpcActions({
  npc,
  canWrite,
  onMorale,
  hit,
  rollFor = rollForTable,
  onActed,
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
            onActed={onActed}
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
  onActed,
}: {
  npc: TrayNpc
  entry: NpcAction
  live: boolean
  open: boolean
  onOpen: (open: boolean) => void
  hit: NpcHit | undefined
  rollFor: typeof rollForTable
  onActed: (() => void) | undefined
}) {
  // The same row text as the player's board: the effect alone.
  // A chassis ability names its chassis by a token: the row reads the name (r5 B9).
  const effect = useMemo(
    () =>
      actionEffect(entry.action).map((block) =>
        typeof block.value === 'string' && block.value.includes(CHASSIS_TOKEN)
          ? { ...block, value: block.value.replaceAll(CHASSIS_TOKEN, entry.source) }
          : block
      ),
    [entry.action, entry.source]
  )
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
    onActed?.()
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
                    {/* The result and its hit sit at the top, above the table (r5 B6). */}
                    {rolled ? (
                      <div style={RESULT}>
                        <p className="su-play-resolve__note" aria-live="polite">
                          {rolled.die} · {rolled.band}
                        </p>
                        {!missed(rolled.band) && damage && hit ? (
                          <HitOffer npc={npc} damage={damage} hit={hit} />
                        ) : null}
                      </div>
                    ) : null}
                    <PlayRollInstrument
                      table={NPC_ACTION}
                      roll={rolled?.die ?? null}
                      onRoll={live ? () => void roll() : undefined}
                    />
                  </div>
                ),
              },
            }
          : {
              // Always contentful, so a weapon with no effect text still shows its
              // range, damage and traits before Use (r5 B8).
              body: {
                text: false,
                children:
                  typeof first === 'string' ? (
                    <TraitProse as="p" className="su-play-act__effect" text={first} />
                  ) : null,
              },
            })}
      />
    </li>
  )
}

/**
 * A rolled weapon's hit, two presses from its target (r4 D2): the button
 * names the damage, its menu the seats that take it and what each is left
 * with; a seat pressed is proposed it at once.
 */
function HitOffer({ npc, damage, hit }: { npc: TrayNpc; damage: HitDamage; hit: NpcHit }) {
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
                // The roll was veiled: the reason names the table, never the NPC (r7 C7).
                reason: veiledReason(NPC_ACTION).slice(0, PROPOSAL_REASON_MAX),
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
