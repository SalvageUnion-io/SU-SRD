/**
 * PlayGameStateSwitch — the Mediator's game state in the Play bar (play.md
 * §10): one Compact `Segmented` control, Scene | Begin
 * Downtime, in the Situation switch's place.
 *
 *  - **Begin Downtime** starts it at the first step, which moves every
 *    player's screen into Downtime (their Situation follows the Game's row).
 *    Running, the option reads "Downtime · Step 3".
 *  - **Scene** ends it. At the last step it simply ends; before it, it asks
 *    first, since a new Downtime starts from the first step and its upkeep is
 *    due again (ADR-007).
 *
 * Every option is off while writes cannot go.
 */

import { downtimeStepCount, UPKEEP_STEP_NAME } from 'game-domain/rules/downtime'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ConfirmDialog, Segmented, SegmentedOption, tokens } from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
import type { PlayDowntime } from '../situation.model'
import { downtimeOptionLabel } from './mediatorTable.model'

const ROW = { alignItems: 'center', display: 'flex', gap: tokens.space[8] } satisfies CSSProperties

const GROW = { flex: '1 1 0%' } satisfies CSSProperties

/** The leading label sits on the Play bar's band: its foreground (`PlayBar`). */
const LABEL = {
  color: 'inherit',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  letterSpacing: tokens.tracking.capsTight,
} satisfies CSSProperties

/** The phone form's row: the options share the screen's width (`fill`). */
const FILL_ROW = { ...ROW, width: '100%' } satisfies CSSProperties

export function PlayGameStateSwitch({
  downtime,
  canWrite,
  fill = false,
}: {
  downtime: PlayDowntime
  canWrite: boolean
  /** The phone form: no leading label, the options share the row (play.md §11). */
  fill?: boolean
}) {
  const [confirmEnd, setConfirmEnd] = useState(false)
  const { running, stepIndex } = downtime.downtime
  const count = downtimeStepCount()
  const last = (stepIndex ?? 0) >= count - 1

  return (
    <div style={fill ? FILL_ROW : ROW}>
      {!fill && (
        <span style={LABEL} aria-hidden="true">
          {mediatorCopy('gameState')}
        </span>
      )}
      <Segmented
        label={mediatorCopy('gameState')}
        size="compact"
        fill={fill}
        style={fill ? GROW : undefined}
      >
        <SegmentedOption
          pressed={!running}
          disabled={!canWrite}
          onClick={() => {
            if (!running) return
            if (last) downtime.end()
            else setConfirmEnd(true)
          }}
        >
          {mediatorCopy('scene')}
        </SegmentedOption>
        <SegmentedOption
          pressed={running}
          disabled={!canWrite}
          onClick={() => {
            if (!running) downtime.begin()
          }}
        >
          {downtimeOptionLabel(running, stepIndex)}
        </SegmentedOption>
      </Segmented>
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        tone="danger"
        title={mediatorCopy('endDowntimeEarly')}
        body={mediatorCopy('theTableIsOnStep', {
          value: (stepIndex ?? 0) + 1,
          count,
          upkeepStepName: UPKEEP_STEP_NAME,
        })}
        confirmLabel={mediatorCopy('endDowntime')}
        onConfirm={() => {
          downtime.end()
        }}
      />
    </div>
  )
}
