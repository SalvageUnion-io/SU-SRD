/**
 * PlayDowntimeColumn — the Actions column while Downtime runs (play.md §6): the ten guide
 * steps (Tally Salvage … Prepare for the next Salvage Run) as a track, the
 * current step as one box (`PlayDowntimeStep`), then the Downtime actions on
 * hand and the field actions collapsed below them.
 *
 * Solo (or for the Game's Mediator) the track puts Downtime on any step
 * (`setStep`, `PlayDowntimeTrack`); for a player in a Game it only shows
 * where the table is. The heading is a Slab,
 * so the step box and every row stay level 1 (play.md §12).
 */

import { currentDowntimeStep } from 'game-domain/rules/downtime'
import { Slab } from '../components/index'
import { playCopy } from '../messages/play'
import { PlayAwayGroup, PlayEntryList, PlayOrphanResolve } from './PlayActionsList'
import { PlayDowntimeStep } from './PlayDowntimeStep'
import { PlayDowntimeTrack } from './PlayDowntimeTrack'
import { splitOnHand } from './playActions.model'
import type { Play } from './situation.model'
import type { PlayActions } from './usePlayActions'

export function PlayDowntimeColumn({ play, actions }: { play: Play; actions: PlayActions }) {
  const { steps, index: idx, step, count } = currentDowntimeStep(play.downtime.downtime.stepIndex)
  const setStep = play.downtime.setStep
  const { onHand, away } = splitOnHand(actions.entries)

  return (
    <>
      <Slab as="h2" label={playCopy('downtimeStepOf', { value: idx + 1, count })} />
      <PlayDowntimeTrack steps={steps} current={idx} onStep={setStep} canWrite={play.canWrite} />
      {step && (
        <PlayDowntimeStep
          key={idx}
          play={play}
          actions={actions}
          step={step}
          stepIndex={idx}
          stepCount={count}
        />
      )}
      <PlayOrphanResolve actions={actions} />
      <Slab label={playCopy('downtimeActions')} />
      <PlayEntryList
        entries={onHand}
        play={play}
        actions={actions}
        label={playCopy('downtimeActions')}
      />
      <PlayAwayGroup
        title={playCopy('fieldActions')}
        entries={away}
        play={play}
        actions={actions}
      />
    </>
  )
}
