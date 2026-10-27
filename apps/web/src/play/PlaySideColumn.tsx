/**
 * PlaySideColumn — the Cockpit's end column's panes: the Crew (Game only,
 * play.md §7), then the roll Tables and the Feed (§8), one under another
 * from `lg`, each its own tab below it.
 *
 *  - **Crew** (`PlayCrewSection`): one line per other seat, from `crew.vitals`
 *    (`useGameFeed`) and the seats (`useGameBoardSources`).
 *  - **Tables** (`PlayTablesSection`): pinned for the Situation, Find for the
 *    rest, and the screen's one Post toggle, defaulting to `postsByDefault`
 *    (the Mediator private).
 *  - **Feed** (`PlayFeedSection`): the crew's rolls, alerts and proposals with
 *    my own rolls and changes (`playRolls`), newest first; solo only my own.
 *
 * What the three share is `usePlaySide`, called once per screen by
 * `PlayCockpit`: the roll dispatch lives there (`usePlayRollDispatch`), so
 * every roll recorded anywhere in Play is written to the Game's log and, per
 * the toggle, posted to Discord, its result on its Feed line.
 *
 * Each section's heading is a Slab, never a `TitledBox`, so what a section
 * lists stays level 1 (play.md §12). The Tables and Feed sections are the
 * Mediator's too (`PlayMediatorSide`), over the same `useSideFeed`.
 */

import type { OverloadTable } from 'salvageunion-reference/rules'
import { overloadTableOf, resolveChassisRef } from 'salvageunion-reference/rules'
import { SlabSection } from '../components/index'
import { playCopy } from '../messages/play'
import type { RosterLine } from './mediator/encounterRoster.model'
import { PlayCrew } from './PlayCrew'
import { PlayFeed } from './PlayFeed'
import { PlayTables } from './PlayTables'
import type { PlayColumnProps } from './situation.model'
import type { PlaySide, SideFeed } from './usePlaySide'

/** The Crew: a Game's other seats. Nothing solo. */
export function PlayCrewSection({ target, side }: PlayColumnProps & { side: PlaySide }) {
  if (target.gameId === null) return null
  return (
    <SlabSection as="h2" id="play-crew" title={playCopy('crew')}>
      <PlayCrew
        gameId={target.gameId}
        selfPilotId={target.pilotId}
        crew={side.feed.crew}
        seats={side.seats}
      />
    </SlabSection>
  )
}

/** A Tables or Feed section: the screen's shared side, and its Slab ids' prefix. */
type SideSectionProps = { side: SideFeed; idPrefix: 'play' | 'mediate' }

/** The roll Tables, pinned for the Situation (or the Game's state), and the Post toggle. */
export function PlayTablesSection({
  side,
  idPrefix,
  downtime,
  solo,
  prepared,
  mechTables,
  onField,
}: SideSectionProps & {
  downtime: boolean
  solo: boolean
  prepared?: readonly string[]
  mechTables?: OverloadTable
  /** The Mediator's: field a rolled encounter row on the Opposition. */
  onField?: ((lines: readonly RosterLine[]) => Promise<number>) | undefined
}) {
  return (
    <SlabSection as="h2" id={`${idPrefix}-tables`} title={playCopy('tables')}>
      <PlayTables
        downtime={downtime}
        mechTables={mechTables}
        solo={solo}
        post={side.post}
        onPostChange={side.setPost}
        binding={side.binding}
        prepared={prepared}
        onField={onField}
      />
    </SlabSection>
  )
}

/** The Feed: rolls, alerts and proposals, newest first. */
export function PlayFeedSection({
  side,
  idPrefix,
  canWrite,
}: SideSectionProps & { canWrite: boolean }) {
  return (
    <SlabSection as="h2" id={`${idPrefix}-feed`} title={playCopy('feed')}>
      <PlayFeed
        gameId={side.gameId}
        entries={side.entries}
        posts={side.dispatch.posts}
        postNow={side.dispatch.postNow}
        canWrite={canWrite}
      />
    </SlabSection>
  )
}

/** The player's Tables and Feed sections: the Tables pane. */
export function PlayerTablesAndFeed({ target, play, side }: PlayColumnProps & { side: SideFeed }) {
  return (
    <>
      <PlayTablesSection
        side={side}
        idPrefix="play"
        downtime={play.situation === 'downtime'}
        mechTables={
          play.boardedMech
            ? overloadTableOf(resolveChassisRef(play.boardedMech.chassisRef))
            : 'reactor'
        }
        solo={target.gameId === null}
      />
      <PlayFeedSection side={side} idPrefix="play" canWrite={play.canWrite} />
    </>
  )
}
