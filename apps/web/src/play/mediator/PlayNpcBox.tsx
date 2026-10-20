/**
 * PlayNpcBox — one of the Opposition on the Mediator's screen (play.md §10,
 * wireframe pin 3): a unit box in the adversary tone, level 1 in the centre
 * column, as the Units column draws a pilot or a mech. Inside it (level 2,
 * plain content): its HP or SP as a live vital (`PlayVital`, − / +, through
 * `mediator.updateNpc`), and its last Morale roll.
 *
 * Its band carries what it is (NPC, Mech, Bio-Titan, …), **Actions**, which
 * lists its actions under the Opposition (pressed while they are the ones
 * listed), and ⋯: the full reference card, Rename and Delete. At 0 it is
 * down: dashed, struck, and never removed for you (ADR-007); Delete is offered
 * as a chip on its band, before ⋯, behind a confirm.
 */

import type { CSSProperties } from 'react'
import {
  Button,
  HeaderMenu,
  Stat,
  TitledBox,
  Toggle,
  tokens,
  useDetailModal,
} from '../../components/index'
import { PlayVital } from '../PlayVital'
import { npcKind } from './npcActions.model'
import type { TrayNpc } from './opposition.model'

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
}

export function PlayNpcBox({
  npc,
  chosen,
  onChoose,
  canWrite,
  onHp,
  onRename,
  onRemove,
}: PlayNpcBoxProps) {
  const detail = useDetailModal(npc.entity ?? undefined, { pattern: npc.pattern ?? undefined })
  const stat = npc.statKind === 'sp' ? 'SP' : 'HP'
  return (
    <li className="su-play-npc" data-chosen={chosen || undefined}>
      <TitledBox
        as="section"
        title={npc.name}
        label={`${npcKind(npc)}: ${npc.name}${npc.down ? ', down' : ''}`}
        tone="adversary"
        className="su-play-unit"
        reference={npc.down}
        chips={<Stat label={npc.down ? `${npcKind(npc)} · down` : npcKind(npc)} size="compact" />}
        controls={
          <span style={CONTROLS}>
            <Toggle
              size="mini"
              pressed={chosen}
              aria-label={`${npc.name}’s actions`}
              onClick={onChoose}
            >
              Actions
            </Toggle>
            {npc.down ? (
              <Button
                variant="ghost"
                size="mini"
                disabled={!canWrite}
                aria-label={`Delete ${npc.name}`}
                onClick={onRemove}
              >
                Delete
              </Button>
            ) : null}
            <HeaderMenu
              variant="overflow"
              label={`More for ${npc.name}`}
              trigger={null}
              sections={[
                [
                  ...(npc.entity === null
                    ? []
                    : [
                        {
                          id: 'card',
                          label: 'Reference card',
                          onSelect: () => detail.control.onClick?.(),
                        },
                      ]),
                  { id: 'rename', label: 'Rename…', onSelect: canWrite ? onRename : undefined },
                  {
                    id: 'remove',
                    label: 'Delete…',
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
        {npc.down ? <p style={MUTED}>At 0 · down</p> : null}
        <p role="status" aria-live="polite" style={npc.lastRoll ? LINE : MUTED}>
          {npc.lastRoll ? (
            <>
              <span style={STRONG}>
                Morale {npc.lastRoll.roll}
                {npc.lastRoll.label ? ` · ${npc.lastRoll.label}` : ''}
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
