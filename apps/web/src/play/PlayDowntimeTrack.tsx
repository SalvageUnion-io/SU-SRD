/**
 * PlayDowntimeTrack — the ten guide steps of a Downtime as a numbered track
 * (play.md §6, §10), the one the table is on in ink, the ones behind it done;
 * one behind it that previewed a change nobody applied is skipped, and keeps
 * the paper ground of a step still to do (r4 A6).
 * The player's Downtime column and the Mediator's centre both draw it.
 *
 * A step the table jumped over, never on it, reads skipped too, never done
 * (r8 B9, SB8-16): the track remembers each jump it sees, until the step is
 * stood on.
 *
 * With `onStep` (solo, or the Game's Mediator) a step is a button that puts
 * the Downtime on it; without, the track only shows where the table is.
 */

import { useState } from 'react'
import type { RefObjectGuideStep } from 'salvageunion-reference'
import { TrackStep } from '../components/app'
import { playCopy } from '../messages/play'

type PlayDowntimeTrackProps = {
  steps: readonly RefObjectGuideStep[]
  /** The step the Downtime is on, 0-based. */
  current: number
  /** Put the Downtime on a step; absent, the track is a read-out. */
  onStep?: ((stepIndex: number) => void) | null
  /** Writes may go: the buttons are live. */
  canWrite: boolean
  /** Steps behind the table that previewed a change nobody applied: skipped, not done (r4 A6). */
  skipped?: readonly number[]
}

export function PlayDowntimeTrack({
  steps,
  current,
  onStep,
  canWrite,
  skipped = [],
}: PlayDowntimeTrackProps) {
  const [seen, setSeen] = useState({ at: current, jumped: [] as readonly number[] })
  if (seen.at !== current) {
    const over =
      current > seen.at + 1
        ? Array.from({ length: current - seen.at - 1 }, (_, i) => seen.at + 1 + i)
        : []
    setSeen({
      at: current,
      jumped: [...seen.jumped.filter((i) => i !== current), ...over],
    })
  }
  const passedOver = new Set([...skipped, ...seen.jumped])
  return (
    <ol className="su-play-dt-track" aria-label={playCopy('downtimeSteps')}>
      {steps.map((s, i) => {
        const missed = i < current && passedOver.has(i)
        const label = `Step ${i + 1}: ${s.name}${missed ? ', skipped' : i < current ? ', done' : ''}`
        const state = missed ? 'skipped' : i < current ? 'past' : i === current ? 'now' : 'next'
        return (
          <li key={s.name} data-state={state}>
            {onStep ? (
              <TrackStep
                className="su-play-dt-track__step"
                aria-label={label}
                aria-current={i === current ? 'true' : undefined}
                disabled={!canWrite}
                onClick={() => {
                  if (i !== current) onStep(i)
                }}
              >
                {i + 1}
              </TrackStep>
            ) : (
              <span
                className="su-play-dt-track__step"
                role="img"
                aria-label={label}
                aria-current={i === current ? 'true' : undefined}
              >
                {i + 1}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
