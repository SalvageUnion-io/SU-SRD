/**
 * PlayDowntimeTrack — the ten guide steps of a Downtime as a numbered track
 * (play.md §6, §10), the one the table is on in ink, the ones behind it done.
 * The player's Downtime column and the Mediator's centre both draw it.
 *
 * With `onStep` (solo, or the Game's Mediator) a step is a button that puts
 * the Downtime on it; without, the track only shows where the table is.
 */

import type { RefObjectGuideStep } from 'salvageunion-reference'
import { TrackStep } from '../components/index'
import { playCopy } from '../messages/play'

type PlayDowntimeTrackProps = {
  steps: readonly RefObjectGuideStep[]
  /** The step the Downtime is on, 0-based. */
  current: number
  /** Put the Downtime on a step; absent, the track is a read-out. */
  onStep?: ((stepIndex: number) => void) | null
  /** Writes may go: the buttons are live. */
  canWrite: boolean
}

export function PlayDowntimeTrack({ steps, current, onStep, canWrite }: PlayDowntimeTrackProps) {
  return (
    <ol className="su-play-dt-track" aria-label={playCopy('downtimeSteps')}>
      {steps.map((s, i) => {
        const label = `Step ${i + 1}: ${s.name}${i < current ? ', done' : ''}`
        const state = i < current ? 'past' : i === current ? 'now' : 'next'
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
