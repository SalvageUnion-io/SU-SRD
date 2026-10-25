/**
 * PlayNpcBox — one of the Opposition on the Mediator's screen (play.md §10): a unit box in the adversary tone, level 1 in the centre
 * column, as the Units column draws a pilot or a mech. Inside it (level 2,
 * plain content): its HP or SP as a live vital (`PlayVital`, − / +, through
 * `mediator.updateNpc`), and its last Morale roll.
 *
 * Its band carries what it is (NPC, Mech, Bio-Titan, …), **Actions**, which
 * lists its actions under the Opposition (pressed while they are the ones
 * listed), and ⋯: the full reference card, Mark important, Rename and Delete.
 * At 0 it is down: dashed, struck, and never removed for you (ADR-007); Delete
 * is offered as a chip on its band, before ⋯, behind a confirm. A downed Mech
 * or Vehicle offers its wreck's salvage under its vital (`PlayWreckSalvage`),
 * into the crawler.
 *
 * An important NPC (Workshop Manual p.255) says so on its kind chip. A mech
 * adds its EP and Heat (Heat's redline as danger) and a Heat Check; at 0 any
 * of them offers its Critical roll, Critical Damage or Critical Injury, whose
 * row reads under the Morale line.
 */

import type { CSSProperties } from 'react'
import type { rollForTable } from '../../components/index'
import {
  Button,
  HeaderMenu,
  heatDangerFrom,
  Stat,
  TitledBox,
  Toggle,
  tokens,
  useDetailModal,
} from '../../components/index'
import type { ImportantTable } from '../../lib/rules/opposition'
import { criticalTable } from '../../lib/rules/opposition'
import { mediatorCopy } from '../../messages/play-mediator'
import { PlayVital } from '../PlayVital'
import { npcKind } from './npcActions.model'
import type { TrayNpc } from './opposition.model'
import { PlayWreckSalvage } from './PlayWreckSalvage'
import type { PlayMediator } from './usePlayMediator'
import { wreckOf } from './wreck.model'

const LINE = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  margin: 0,
} satisfies CSSProperties

const MUTED = { ...LINE, color: tokens.color.ink75 } satisfies CSSProperties

const STRONG = { fontWeight: tokens.weight.bold } satisfies CSSProperties

/** What a table an important NPC rolls is called: the book's, or Heat Check. */
function tableName(table: ImportantTable): string {
  return table === 'heat-check' ? mediatorCopy('heatCheck') : (criticalTable(table)?.name ?? '')
}

const CONTROLS = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[4],
} satisfies CSSProperties

type PlayNpcBoxProps = {
  npc: TrayNpc
  /** Its actions are the ones listed under the Opposition. */
  chosen: boolean
  onChoose: () => void
  canWrite: boolean
  onHp: (next: number) => void
  onRename: () => void
  onRemove: () => void
  /** Settle its wreck's salvage once it is down. */
  onSalvage: PlayMediator['salvageWreck']
  /** Whether the Mediator holds a crawler a wreck's haul can go to. */
  hasCrawler: boolean
  rollFor?: typeof rollForTable
  onImportant: (important: boolean) => void
  onReactor: (patch: { currentEp?: number; currentHeat?: number }) => void
  onCritical: () => void
  onHeatCheck: () => void
}

export function PlayNpcBox({
  npc,
  chosen,
  onChoose,
  canWrite,
  onHp,
  onRename,
  onRemove,
  onSalvage,
  hasCrawler,
  rollFor,
  onImportant,
  onReactor,
  onCritical,
  onHeatCheck,
}: PlayNpcBoxProps) {
  const detail = useDetailModal(npc.entity ?? undefined, { pattern: npc.pattern ?? undefined })
  const stat = npc.statKind === 'sp' ? 'SP' : 'HP'
  const wreck = npc.down ? wreckOf(npc) : null
  const { reactor, track } = npc
  const critical = npc.important && npc.down && track !== null ? track.critical : null
  const lastImportant = npc.lastImportantRoll
  return (
    <li className="su-play-npc" data-chosen={chosen || undefined}>
      <TitledBox
        as="section"
        title={npc.name}
        label={`${npcKind(npc)}: ${npc.name}${npc.down ? ', down' : ''}`}
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
            size="compact"
          />
        }
        controls={
          <span style={CONTROLS}>
            <Toggle
              size="mini"
              pressed={chosen}
              aria-label={mediatorCopy('sActions', { name: npc.name })}
              onClick={onChoose}
            >
              {mediatorCopy('actions2')}
            </Toggle>
            {npc.down ? (
              <Button
                variant="ghost"
                size="mini"
                disabled={!canWrite}
                aria-label={mediatorCopy('delete2', { name: npc.name })}
                onClick={onRemove}
              >
                {mediatorCopy('delete')}
              </Button>
            ) : null}
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
        {npc.down ? <p style={MUTED}>{mediatorCopy('at0Down')}</p> : null}
        {wreck !== null ? (
          <PlayWreckSalvage
            npc={npc}
            wreck={wreck}
            canWrite={canWrite}
            hasCrawler={hasCrawler}
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
          <p role="status" aria-live="polite" style={LINE}>
            <span style={STRONG}>
              {mediatorCopy('importantRoll', {
                table: tableName(lastImportant.table),
                roll: lastImportant.roll,
                value: lastImportant.label ? ` · ${lastImportant.label}` : '',
              })}
            </span>
            {` — ${lastImportant.value}`}
          </p>
        ) : null}
        <p role="status" aria-live="polite" style={npc.lastRoll ? LINE : MUTED}>
          {npc.lastRoll ? (
            <>
              <span style={STRONG}>
                {mediatorCopy('morale', {
                  roll: npc.lastRoll.roll,
                  value: npc.lastRoll.label ? ` · ${npc.lastRoll.label}` : '',
                })}
              </span>
              {` — ${npc.lastRoll.value}`}
            </>
          ) : (
            'No Morale roll yet'
          )}
        </p>
      </TitledBox>
      {detail.modal}
    </li>
  )
}
