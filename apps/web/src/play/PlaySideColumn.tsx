/**
 * PlaySideColumn — the Cockpit's right column (~320px): the Crew (Game
 * only, play.md §7), the roll Tables and the Feed (§8), one under another.
 *
 *  - **Crew** (`PlayCrewSection`): one line per other seat, from `crew.vitals`
 *    (`useGameFeed`) and the seats (`useGameBoardSources`).
 *  - **Tables** (`PlayTablesSection`): pinned for the Situation, Find for the
 *    rest, and the screen's one Post toggle, defaulting to `postsByDefault`
 *    (the Mediator private).
 *  - **Feed** (`PlayFeedSection`): the crew's rolls, alerts and proposals with
 *    my own rolls and changes (`playRolls`), newest first; solo only my own.
 *
 * What the three share is `usePlaySide`, called once per screen: the roll
 * dispatch lives there (`usePlayRollDispatch`), so every roll recorded
 * anywhere in Play is written to the Game's log and, per the toggle, posted to
 * Discord, its result on its Feed line. The phone form (`PlayCockpitPhone`,
 * play.md §11) calls it once too and puts the sections on its own tabs.
 *
 * Each section's heading is a Slab, never a `TitledBox`, so what a section
 * lists stays level 1 (play.md §12). The Tables and Feed sections are the
 * Mediator's too (`PlayMediatorSide`), over the same `useSideFeed`.
 */

import type { CSSProperties } from 'react'
import { SlabSection, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { PlayCrew } from './PlayCrew'
import { PlayFeed } from './PlayFeed'
import { PlayTables } from './PlayTables'
import type { PlayColumnProps } from './situation.model'
import type { PlaySide, SideFeed } from './usePlaySide'
import { usePlaySide } from './usePlaySide'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

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
}: SideSectionProps & { downtime: boolean; solo: boolean }) {
  return (
    <SlabSection as="h2" id={`${idPrefix}-tables`} title={playCopy('tables')}>
      <PlayTables
        downtime={downtime}
        solo={solo}
        post={side.post}
        onPostChange={side.setPost}
        binding={side.binding}
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
        entries={side.entries}
        posts={side.dispatch.posts}
        postNow={side.dispatch.postNow}
        canWrite={canWrite}
      />
    </SlabSection>
  )
}

/** The player's Tables and Feed sections, as the canvas and the phone's Tables tab stack them. */
export function PlayerTablesAndFeed({ target, play, side }: PlayColumnProps & { side: SideFeed }) {
  return (
    <>
      <PlayTablesSection
        side={side}
        idPrefix="play"
        downtime={play.situation === 'downtime'}
        solo={target.gameId === null}
      />
      <PlayFeedSection side={side} idPrefix="play" canWrite={play.canWrite} />
    </>
  )
}

export function PlaySideColumn({ target, play }: PlayColumnProps) {
  const side = usePlaySide({ target, play })
  return (
    <div style={STACK}>
      <PlayCrewSection target={target} play={play} side={side} />
      <PlayerTablesAndFeed target={target} play={play} side={side} />
    </div>
  )
}
