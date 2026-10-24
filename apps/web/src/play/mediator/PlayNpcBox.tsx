/**
 * PlayNpcBox — one of the Opposition on the Mediator's screen (play.md §10): a unit box in the adversary tone, level 1 in the centre
 * column, as the Units column draws a pilot or a mech. Inside it (level 2,
 * plain content): its HP or SP as a live vital (`PlayVital`, − / +, through
 * `mediator.updateNpc`), and its last Morale roll.
 *
 * Its band carries what it is (NPC, Mech, Bio-Titan, …), **Actions**, which
 * lists its actions under the Opposition (pressed while they are the ones
 * listed), and ⋯: the full reference card, Rename and Delete. At 0 it is
 * down: dashed, struck, and never removed for you (ADR-007); Delete is offered
 * as a chip on its band, before ⋯, behind a confirm. A downed Mech or Vehicle
 * offers its wreck's salvage under its vital (`PlayWreckSalvage`), into the
 * crawler.
 */

import type { CSSProperties } from 'react'
import type { rollForTable } from '../../components/index'
import {
  Button,
  HeaderMenu,
  Stat,
  TitledBox,
  Toggle,
  tokens,
  useDetailModal,
} from '../../components/index'
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
}: PlayNpcBoxProps) {
  const detail = useDetailModal(npc.entity ?? undefined, { pattern: npc.pattern ?? undefined })
  const stat = npc.statKind === 'sp' ? 'SP' : 'HP'
  const wreck = npc.down ? wreckOf(npc) : null
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
            label={npc.down ? mediatorCopy('down', { npcKind: npcKind(npc) }) : npcKind(npc)}
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
