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
import { skippedSteps, stepNames } from './playDowntime.model'
import type { Play } from './situation.model'
import type { PlayActions } from './usePlayActions'

export function PlayDowntimeColumn({ play, actions }: { play: Play; actions: PlayActions }) {
  const { steps, index: idx, step, count } = currentDowntimeStep(play.downtime.downtime.stepIndex)
  const setStep = play.downtime.setStep
  const { onHand, away } = splitOnHand(actions.entries)
  // Walked past without applying what it previewed: skipped, never done (r4 A6).
  const skipped = skippedSteps({
    steps,
    upTo: idx - 1,
    taken: play.downtime.doneSteps,
    pilot: actions.pilot,
    mech: actions.mech,
    crawler: actions.crawler,
    pilotCrawlerTl: actions.crawlerTechLevel,
    upkeep: { spent: play.downtime.downtime.upkeepSpent, canPay: !play.downtime.locked },
  })

  return (
    <>
      <Slab as="h2" label={playCopy('downtimeStepOf', { value: idx + 1, count })} flush />
      <PlayDowntimeTrack
        steps={steps}
        current={idx}
        onStep={setStep}
        canWrite={play.canWrite}
        skipped={skipped}
      />
      {skipped.length > 0 && (
        <p className="su-play-resolve__note">
          {playCopy('skippedSteps', { steps: stepNames(steps, skipped) })}
        </p>
      )}
      {step && (
        <PlayDowntimeStep
          key={idx}
          play={play}
          actions={actions}
          step={step}
          stepIndex={idx}
          stepCount={count}
          steps={steps}
        />
      )}
      <PlayOrphanResolve actions={actions} />
      <Slab label={playCopy('downtimeActions')} flush />
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
