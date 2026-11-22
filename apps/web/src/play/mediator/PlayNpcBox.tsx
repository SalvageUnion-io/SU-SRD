/**
 * PlayNpcBox — one of the Opposition on the Mediator's screen (play.md §10): a unit box in the adversary tone, level 1 in the centre
 * column, as the Units column draws a pilot or a mech. Inside it (level 2,
 * plain content): its HP or SP as a live vital (`PlayVital`, − / +, through
 * `mediator.updateNpc`), Morale due with Roll when the book calls for its
 * check (Core Book p.268; never rolled for you), and its last roll.
 *
 * Its band carries what it is (NPC, Mech, Bio-Titan, …), **Actions**, which
 * opens its actions inside its own card, under the box (r4 D1: pressed while
 * they are open; nothing else on the screen moves), and ⋯: the full reference card, Mark important, Rename and Delete.
 * At 0 it is down: dashed, struck, and never removed for you (ADR-007). It
 * folds to its one-line band (r6 B8), Delete inside its ⋯; the list sinks it
 * below the living (`sinkDowned`). A downed Mech or Vehicle keeps its box
 * until its wreck is salvaged (`PlayWreckSalvage`, into the crawler or a crew
 * Mech's hold), then folds too.
 *
 * An important NPC (Workshop Manual p.255) says so on its kind chip. A mech
 * adds its EP and Heat (Heat's redline as danger) and a Heat Check; at 0 any
 * of them offers its Critical roll, Critical Damage or Critical Injury, whose
 * row reads under the Morale line.
 */

import type { ReactNode } from 'react'
import { heatDangerFrom, useDetailModal } from '../../components/app'
import type { rollForTable } from '../../components/index'
import { Button, HeaderMenu, Stat, TitledBox, Toggle } from '../../components/index'
import type { ImportantTable } from '../../lib/rules/opposition'
import { checksMoraleAlone, criticalTable } from '../../lib/rules/opposition'
import { mediatorCopy } from '../../messages/play-mediator'
import { PlayVital } from '../PlayVital'
import { ActedMark } from './MediatorInitiative'
import { CONTROLS, NOTE_MUTED } from './mediatorStyles.model'
import { npcKind } from './npcActions.model'
import type { TrayNpc } from './opposition.model'
import type { WreckMech } from './PlayWreckSalvage'
import { PlayWreckSalvage } from './PlayWreckSalvage'
import { RollResultLine } from './RollResultLine'
import type { PlayMediator } from './usePlayMediator'
import { wreckOf } from './wreck.model'

/** What a table an important NPC rolls is called: the book's, or Heat Check. */
function tableName(table: ImportantTable): string {
  return table === 'heat-check' ? mediatorCopy('heatCheck') : (criticalTable(table)?.name ?? '')
}

type PlayNpcBoxProps = {
  npc: TrayNpc
  /** Its actions are open in its card. */
  chosen: boolean
  /** Actions was pressed: open them, or shut them. */
  onChoose: () => void
  /** Its actions (`PlayNpcActions`), while open: under the box, inside the card. */
  actions?: ReactNode
  canWrite: boolean
  onHp: (next: number) => void
  onRename: () => void
  onRemove: () => void
  /** Settle its wreck's salvage once it is down. */
  onSalvage: PlayMediator['salvageWreck']
  /** Whether the Mediator holds a crawler a wreck's haul can go to. */
  hasCrawler: boolean
  /** The crew's Mechs a wreck's haul can be proposed to (r5 B2). */
  mechs?: readonly WreckMech[]
  /** Keep its wreck's Mech Salvage roll (r5 B1). */
  onSalvageRoll: (npc: TrayNpc, roll: number) => Promise<unknown>
  rollFor?: typeof rollForTable
  onImportant: (important: boolean) => void
  onReactor: (patch: { currentEp?: number; currentHeat?: number }) => void
  onCritical: () => void
  onHeatCheck: () => void
  /** Its Morale check is due (Core Book p.268): the chip and Roll show. */
  moraleDue?: boolean
  /** Roll its Morale check: the tray's write. */
  onMorale?: () => void
  /** While Group Initiative is kept (r6 B4): whether it acted this round, and the toggle. */
  acted?: { acted: boolean; onToggle?: (() => void) | undefined } | undefined
}

export function PlayNpcBox({
  npc,
  chosen,
  onChoose,
  actions,
  canWrite,
  onHp,
  onRename,
  onRemove,
  onSalvage,
  hasCrawler,
  mechs,
  onSalvageRoll,
  rollFor,
  onImportant,
  onReactor,
  onCritical,
  onHeatCheck,
  moraleDue = false,
  onMorale,
  acted,
}: PlayNpcBoxProps) {
  const detail = useDetailModal(npc.entity ?? undefined, { pattern: npc.pattern ?? undefined })
  const stat = npc.statKind === 'sp' ? 'SP' : 'HP'
  const wreck = npc.down ? wreckOf(npc) : null
  const { reactor, track } = npc
  const critical = npc.important && npc.down && track !== null ? track.critical : null
  const lastImportant = npc.lastImportantRoll
  // Down with nothing left to take: one line, its band (r6 B8).
  const folded = npc.down && !npc.important && (wreck === null || npc.salvaged)
  return (
    <li
      className="su-play-npc"
      data-chosen={chosen || undefined}
      data-folded={folded || undefined}
      data-npc-id={npc.id}
    >
      <TitledBox
        as="section"
        title={npc.name}
        label={mediatorCopy(npc.down ? 'npcLabelDown' : 'npcLabel', {
          kind: npcKind(npc),
          name: npc.name,
        })}
        tone="adversary"
        className="su-play-unit"
        reference={npc.down}
        chips={
          <Stat
            label={[
              npcKind(npc),
              npc.important ? mediatorCopy('important') : null,
              npc.down ? mediatorCopy('down') : null,
            ]
              .filter((part) => part !== null)
              .join(' · ')}
            size="mini"
          />
        }
        controls={
          <span style={CONTROLS}>
            {acted && <ActedMark name={npc.name} acted={acted.acted} onToggle={acted.onToggle} />}
            {folded ? null : (
              <Toggle
                size="mini"
                pressed={chosen}
                aria-label={mediatorCopy('sActions', { name: npc.name })}
                onClick={onChoose}
              >
                {mediatorCopy('actions2')}
              </Toggle>
            )}
            <HeaderMenu
              variant="overflow"
              label={mediatorCopy('moreFor', { name: npc.name })}
              trigger={null}
              sections={[
                [
                  ...(npc.entity === null
                    ? []
                    : [
                        {
                          id: 'card',
                          label: mediatorCopy('referenceCard'),
                          onSelect: () => detail.control.onClick?.(),
                        },
                      ]),
                  ...(track === null
                    ? []
                    : [
                        {
                          id: 'important',
                          label: mediatorCopy(npc.important ? 'notImportant' : 'markImportant'),
                          onSelect: canWrite ? () => onImportant(!npc.important) : undefined,
                        },
                      ]),
                  // The Mediator's call on the spot, whatever the book prompts (r6 B5).
                  ...(npc.down
                    ? []
                    : [
                        {
                          id: 'morale',
                          label: mediatorCopy('rollMoraleMenu'),
                          onSelect: canWrite && onMorale ? onMorale : undefined,
                        },
                      ]),
                  {
                    id: 'rename',
                    label: mediatorCopy('rename2'),
                    onSelect: canWrite ? onRename : undefined,
                  },
                  {
                    id: 'remove',
                    label: mediatorCopy('delete3'),
                    tone: 'danger' as const,
                    onSelect: canWrite ? onRemove : undefined,
                  },
                ],
              ]}
            />
          </span>
        }
      >
        {folded ? null : (
          <>
            {npc.maxHp > 0 ? (
              <PlayVital
                label={stat}
                value={npc.currentHp}
                max={npc.maxHp}
                tone="adversary"
                onChange={canWrite ? onHp : undefined}
              />
            ) : null}
            {reactor !== null ? (
              <>
                <PlayVital
                  label={mediatorCopy('ep')}
                  value={reactor.ep}
                  max={reactor.maxEp}
                  tone="adversary"
                  onChange={canWrite ? (v) => onReactor({ currentEp: v }) : undefined}
                />
                <PlayVital
                  label={mediatorCopy('heat')}
                  value={reactor.heat}
                  max={reactor.heatCap}
                  tone="adversary"
                  danger={reactor.heatCap > 0 ? heatDangerFrom(reactor.heatCap) : undefined}
                  onChange={canWrite ? (v) => onReactor({ currentHeat: v }) : undefined}
                />
              </>
            ) : null}
            {npc.down ? <p style={NOTE_MUTED}>{mediatorCopy('at0Down')}</p> : null}
            {wreck !== null ? (
              <PlayWreckSalvage
                npc={npc}
                wreck={wreck}
                canWrite={canWrite}
                hasCrawler={hasCrawler}
                mechs={mechs}
                onRoll={onSalvageRoll}
                onSettle={onSalvage}
                rollFor={rollFor}
              />
            ) : null}
            {critical !== null || (reactor !== null && !npc.down) ? (
              <span style={CONTROLS}>
                {critical !== null ? (
                  <Button
                    size="mini"
                    disabled={!canWrite}
                    aria-label={mediatorCopy('rollTableFor', {
                      table: tableName(critical),
                      name: npc.name,
                    })}
                    onClick={onCritical}
                  >
                    {mediatorCopy('rollTable', { table: tableName(critical) })}
                  </Button>
                ) : (
                  <Button
                    size="mini"
                    disabled={!canWrite}
                    aria-label={mediatorCopy('heatCheckFor', { name: npc.name })}
                    onClick={onHeatCheck}
                  >
                    {mediatorCopy('heatCheck')}
                  </Button>
                )}
              </span>
            ) : null}
            {lastImportant !== null ? (
              <RollResultLine roll={lastImportant} tableName={tableName(lastImportant.table)} />
            ) : null}
            {moraleDue ? (
              <span style={CONTROLS}>
                <Stat size="mini" label={mediatorCopy('moraleDue')} state="caution" />
                <Button
                  size="mini"
                  disabled={!canWrite || onMorale === undefined}
                  aria-label={mediatorCopy('rollMoraleFor', { name: npc.name })}
                  onClick={onMorale}
                >
                  {mediatorCopy('rollMorale')}
                </Button>
              </span>
            ) : null}
            {/* Morale is a Mech's, a Creature's or a group's (Core Book p.268): a
                lone NPC's card says nothing of it until one is rolled (r6 B5). */}
            {checksMoraleAlone(npc.refSchema) ? (
              <RollResultLine roll={npc.lastRoll} empty={mediatorCopy('noMoraleRoll')} />
            ) : npc.lastRoll !== null ? (
              <RollResultLine roll={npc.lastRoll} />
            ) : null}
          </>
        )}
      </TitledBox>
      {folded ? null : actions}
      {detail.modal}
    </li>
  )
}
