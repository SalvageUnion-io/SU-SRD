/**
 * PlaySituationSwitch — the Play bar's Situation (play.md §3): one Compact `Segmented` control, On foot | Board | Downtime.
 *
 *  - **On foot** climbs out (Dismount). Eject is not here: it is the Mount
 *    row's, behind its confirm (ADR-007).
 *  - **Board** names the mech: "Boarded · <mech>" while boarded. With several
 *    mechs it is a menu ("▾") listing each, with why one cannot be boarded;
 *    with one it boards it; with none it is disabled and says so. An
 *    unassigned spare in the Game is assigned to you first, behind a confirm.
 *  - **Downtime**: in a Game it is the Mediator's, so a player's option is
 *    locked (🔒, "set by the Mediator") and only shows it running. Solo (or for
 *    the Mediator) it starts Downtime; leaving it for On foot or Board ends
 *    it, behind a confirm, since a new Downtime starts from the first step.
 *
 * Every option is off while writes cannot go (Disconnected, Outdated). What
 * each press does is `Play`'s (`usePlaySituation`); this only draws it.
 */

import { ChevronDown, Lock } from 'lucide-react'
import type { CSSProperties } from 'react'
import { HeaderMenu, Segmented, SegmentedOption, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import type { BoardOption } from './boardMenu.model'
import { boardable, boardedMechName, boardMenuSections } from './boardMenu.model'
import type { Play } from './situation.model'
import { useSituationMoves } from './useSituationMoves'
import { isDown } from './zeroVital.model'

const ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
} satisfies CSSProperties

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
const SET_BY_MEDIATOR = playCopy('setByTheMediator')
const SET_BY_MEDIATOR_PHRASE = playCopy('setByTheMediatorPhrase')

/** Pinned below `lg`: the options share the screen's width. */
const FILL_ROW = { ...ROW, width: '100%' } satisfies CSSProperties
const GROW = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

export function PlaySituationSwitch({
  play,
  fill = false,
}: {
  play: Play
  /** Pinned below `lg` (Downtime on a phone, r4 A10): no leading label, the options share the row. */
  fill?: boolean
}) {
  const { go, dialogs } = useSituationMoves(play)
  const { situation, mechs, canWrite, canChangeDowntime } = play
  const { downtime, locked } = play.downtime
  const running = downtime.running

  const boardedName = boardedMechName(play)
  const boarded = situation === 'boarded'
  // A Down Mech is never offered as boarded (r6 A7): where it is, and that it is Down.
  const downName =
    boarded && play.boardedMech !== null && isDown(play.boardedMech.currentSP)
      ? play.boardedMech.name
      : null

  return (
    <div style={fill ? FILL_ROW : ROW}>
      {!fill && (
        <span style={LABEL} aria-hidden="true">
          {playCopy('situation')}
        </span>
      )}
      <Segmented
        label={playCopy('situation')}
        size="compact"
        fill={fill}
        style={fill ? GROW : undefined}
      >
        <SegmentedOption
          pressed={situation === 'onFoot'}
          disabled={!canWrite}
          onClick={() => go({ kind: 'foot' })}
        >
          {playCopy('onFoot')}
        </SegmentedOption>
        <BoardOptionControl
          mechs={mechs}
          pressed={boarded}
          boardedName={boardedName}
          downName={downName}
          disabled={!canWrite}
          onChoose={(option) => go({ kind: 'board', option })}
        />
        <SegmentedOption
          pressed={situation === 'downtime'}
          // Locked and not running, there is nothing to show or press.
          disabled={!canWrite || (locked && !running)}
          title={locked ? SET_BY_MEDIATOR : undefined}
          aria-label={
            locked
              ? playCopy('downtime', { setByMediatorPhrase: SET_BY_MEDIATOR_PHRASE })
              : undefined
          }
          onClick={() => {
            if (!running && canChangeDowntime) play.startDowntime()
          }}
        >
          {playCopy('downtimeWord')}
          {locked && !running && (
            <Lock size={tokens.iconSize.mini} aria-hidden="true" style={GLYPH} />
          )}
        </SegmentedOption>
      </Segmented>
      {dialogs}
    </div>
  )
}

/**
 * The Board option: a menu with several mechs, a plain option with one, and
 * disabled, saying why, with none.
 */
function BoardOptionControl({
  mechs,
  pressed,
  boardedName,
  downName = null,
  disabled,
  onChoose,
}: {
  mechs: readonly BoardOption[]
  pressed: boolean
  boardedName: string | null
  /** The boarded Mech, while it is Down at 0 SP (r6 A7). */
  downName?: string | null
  disabled: boolean
  onChoose: (option: BoardOption) => void
}) {
  const only = mechs.length === 1 ? mechs[0] : undefined
  const label =
    downName !== null
      ? playCopy('mechIsDownHere', { name: downName })
      : pressed
        ? boardedName === null
          ? 'Boarded'
          : `Boarded · ${boardedName}`
        : 'Board'

  if (mechs.length === 0) {
    return (
      <SegmentedOption
        pressed={pressed}
        disabled
        aria-label={playCopy('noMechToBoard2', { label })}
      >
        {/* Said on the option, never only in a hover title a phone can't read. */}
        {pressed ? label : playCopy('noMech')}
      </SegmentedOption>
    )
  }

  if (only !== undefined) {
    const text =
      downName !== null
        ? label
        : `${pressed ? 'Boarded' : 'Board'} · ${pressed && boardedName !== null ? boardedName : only.name}`
    return (
      <SegmentedOption
        pressed={pressed}
        disabled={disabled || !boardable(only)}
        title={only.note ?? undefined}
        aria-label={only.note === null ? undefined : `${text}, ${only.note}`}
        onClick={() => onChoose(only)}
      >
        {text}
      </SegmentedOption>
    )
  }

  return (
    <HeaderMenu
      variant="segment"
      pressed={pressed}
      disabled={disabled}
      label={playCopy('chooseAMech', { label })}
      trigger={
        <>
          {label}
          <ChevronDown size={tokens.iconSize.mini} aria-hidden="true" style={GLYPH} />
        </>
      }
      chevron={false}
      sections={boardMenuSections(mechs, onChoose)}
    />
  )
}
