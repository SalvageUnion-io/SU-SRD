/**
 * PlaySituationSwitch — the Play bar's Situation (play.md §3): one Compact `Segmented` control, On foot | Board | Downtime.
 *
 *  - **On foot** climbs out (Dismount). Eject is not here: it is the Mount
 *    row's, behind its confirm (ADR-007).
 *  - **Board** names the mech: "Boarded · <mech>" while boarded. With several
 *    mechs it is a menu ("▾") listing each, with why one cannot be boarded;
 *    with one it boards it; with none it is disabled and says so. An
 *    unclaimed spare in the Game is claimed first, behind a confirm.
 *  - **Downtime**: in a Game it is the Mediator's, so a player's option is
 *    locked (🔒, "set by the Mediator") and only shows it running. Solo (or for
 *    the Mediator) it starts Downtime; leaving it for On foot or Board ends
 *    it, behind a confirm, since a new Downtime starts from the first step.
 *
 * Every option is off while writes cannot go (Disconnected, Outdated). What
 * each press does is `Play`'s (`usePlaySituation`); this only draws it.
 */

import { downtimeStepCount } from 'game-domain/rules/downtime'
import { ChevronDown, Lock } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ConfirmDialog, HeaderMenu, Segmented, SegmentedOption, tokens } from '../components/index'
import type { BoardOption } from './boardMenu.model'
import { boardable, boardedMechName, boardMenuSections } from './boardMenu.model'
import { ClaimAndBoardConfirm } from './ClaimAndBoardConfirm'
import type { Play } from './situation.model'

const ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
} satisfies CSSProperties

/** The phone form's row: the options share the screen's width (`fill`). */
const FILL_ROW = { ...ROW, width: '100%' } satisfies CSSProperties

const GROW = { flex: '1 1 0%' } satisfies CSSProperties

/** The leading label sits on the Play bar's band: its foreground (`PlayBar`). */
const LABEL = {
  color: 'inherit',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  letterSpacing: tokens.tracking.capsTight,
} satisfies CSSProperties

/** Inline beside the label: the reset makes an svg a block. */
const GLYPH = {
  display: 'inline-block',
  marginLeft: tokens.space[4],
  verticalAlign: '-2px',
} satisfies CSSProperties

/** Where a press that leaves a running Downtime goes once it is ended. */
type Leave = { kind: 'foot' } | { kind: 'board'; option: BoardOption }

/** The reason the Downtime option is locked, read with its name. */
const SET_BY_MEDIATOR = 'Set by the Mediator'
const SET_BY_MEDIATOR_PHRASE = 'set by the Mediator'

export function PlaySituationSwitch({
  play,
  fill = false,
}: {
  play: Play
  /** The phone form: no leading label, the options share the row (play.md §11). */
  fill?: boolean
}) {
  const [leaving, setLeaving] = useState<Leave | null>(null)
  const [claiming, setClaiming] = useState<BoardOption | null>(null)
  const { situation, mechs, canWrite, canChangeDowntime } = play
  const { downtime, locked } = play.downtime
  const running = downtime.running

  /** Go there now, or once a running Downtime this screen may end is ended. */
  function go(to: Leave) {
    if (running && canChangeDowntime) {
      setLeaving(to)
      return
    }
    arrive(to)
  }

  function arrive(to: Leave) {
    if (to.kind === 'foot') play.setOnFoot()
    else if (to.option.state === 'spare') setClaiming(to.option)
    else play.board(to.option.mechId)
  }

  const boardedName = boardedMechName(play)
  const boarded = situation === 'boarded'

  return (
    <div style={fill ? FILL_ROW : ROW}>
      {!fill && (
        <span style={LABEL} aria-hidden="true">
          Situation
        </span>
      )}
      <Segmented label="Situation" size="compact" fill={fill} style={fill ? GROW : undefined}>
        <SegmentedOption
          pressed={situation === 'onFoot'}
          disabled={!canWrite}
          onClick={() => go({ kind: 'foot' })}
        >
          On foot
        </SegmentedOption>
        <BoardOptionControl
          mechs={mechs}
          pressed={boarded}
          boardedName={boardedName}
          disabled={!canWrite}
          short={fill}
          onChoose={(option) => go({ kind: 'board', option })}
        />
        <SegmentedOption
          pressed={situation === 'downtime'}
          // Locked and not running, there is nothing to show or press.
          disabled={!canWrite || (locked && !running)}
          title={locked ? SET_BY_MEDIATOR : undefined}
          aria-label={locked ? `Downtime, ${SET_BY_MEDIATOR_PHRASE}` : undefined}
          onClick={() => {
            if (!running && canChangeDowntime) play.startDowntime()
          }}
        >
          Downtime
          {locked && !running && (
            <Lock size={tokens.iconSize.mini} aria-hidden="true" style={GLYPH} />
          )}
        </SegmentedOption>
      </Segmented>
      <ConfirmDialog
        open={leaving !== null}
        onOpenChange={(open) => {
          if (!open) setLeaving(null)
        }}
        tone="danger"
        title="End Downtime?"
        body={endDowntimeBody(downtime.stepIndex, play.target.gameId !== null)}
        confirmLabel="End Downtime"
        onConfirm={() => {
          const to = leaving
          play.endDowntime()
          setLeaving(null)
          if (to !== null) arrive(to)
        }}
      />
      <ClaimAndBoardConfirm play={play} claiming={claiming} onClose={() => setClaiming(null)} />
    </div>
  )
}

/** What ending a running Downtime early costs, as the confirm says it. */
function endDowntimeBody(stepIndex: number | null, inGame: boolean): string {
  const step = `${inGame ? 'The table is' : 'You are'} on step ${(stepIndex ?? 0) + 1} of ${downtimeStepCount()}.`
  const after = inGame
    ? 'Everyone goes back to their seat, and a new Downtime starts from the first step.'
    : 'A new Downtime starts from the first step.'
  return `${step} ${after}`
}

/**
 * The Board option: a menu with several mechs, a plain option with one, and
 * disabled, saying why, with none.
 */
function BoardOptionControl({
  mechs,
  pressed,
  boardedName,
  disabled,
  short,
  onChoose,
}: {
  mechs: readonly BoardOption[]
  pressed: boolean
  boardedName: string | null
  disabled: boolean
  /** The phone's: "Boarded" alone on the option (the pinned vitals name the mech), the name still in its accessible name. */
  short: boolean
  onChoose: (option: BoardOption) => void
}) {
  const only = mechs.length === 1 ? mechs[0] : undefined
  const label = pressed ? (boardedName === null ? 'Boarded' : `Boarded · ${boardedName}`) : 'Board'
  const shown = short ? (pressed ? 'Boarded' : 'Board') : null

  if (mechs.length === 0) {
    return (
      <SegmentedOption
        pressed={pressed}
        disabled
        title="No Mech to board"
        aria-label={`${label}, no Mech to board`}
      >
        {shown ?? label}
      </SegmentedOption>
    )
  }

  if (only !== undefined) {
    const text = `${pressed ? 'Boarded' : 'Board'} · ${pressed && boardedName !== null ? boardedName : only.name}`
    return (
      <SegmentedOption
        pressed={pressed}
        disabled={disabled || !boardable(only)}
        title={only.note ?? undefined}
        aria-label={
          only.note === null ? (shown === null ? undefined : text) : `${text}, ${only.note}`
        }
        onClick={() => onChoose(only)}
      >
        {shown ?? text}
      </SegmentedOption>
    )
  }

  return (
    <HeaderMenu
      variant="segment"
      pressed={pressed}
      disabled={disabled}
      label={`${label}, choose a Mech`}
      trigger={
        <>
          {shown ?? label}
          <ChevronDown size={tokens.iconSize.mini} aria-hidden="true" style={GLYPH} />
        </>
      }
      chevron={false}
      sections={boardMenuSections(mechs, onChoose)}
    />
  )
}
