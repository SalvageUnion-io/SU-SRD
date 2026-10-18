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
 * lists stays level 1 (play.md §12).
 */

import type { CSSProperties } from 'react'
import { Slab, tokens } from '../components/index'
import { PlayCrew } from './PlayCrew'
import { PlayFeed } from './PlayFeed'
import { PlayTables } from './PlayTables'
import type { PlayColumnProps } from './situation.model'
import type { PlaySide } from './usePlaySide'
import { usePlaySide } from './usePlaySide'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

type SectionProps = PlayColumnProps & { side: PlaySide }

/** The Crew: a Game's other seats. Nothing solo. */
export function PlayCrewSection({ target, side }: SectionProps) {
  if (target.gameId === null) return null
  return (
    <section aria-labelledby="play-crew" style={SECTION}>
      <Slab as="h2" id="play-crew" label="Crew" />
      <PlayCrew
        gameId={target.gameId}
        selfPilotId={target.pilotId}
        crew={side.feed.crew}
        seats={side.seats}
      />
    </section>
  )
}

/** The roll Tables and the Post toggle. */
export function PlayTablesSection({ target, play, side }: SectionProps) {
  return (
    <section aria-labelledby="play-tables" style={SECTION}>
      <Slab as="h2" id="play-tables" label="Tables" />
      <PlayTables
        downtime={play.situation === 'downtime'}
        solo={target.gameId === null}
        post={side.post}
        onPostChange={side.setPost}
        binding={side.binding}
      />
    </section>
  )
}

/** The Feed: rolls, alerts and proposals, newest first. */
export function PlayFeedSection({ play, side }: SectionProps) {
  return (
    <section aria-labelledby="play-feed" style={SECTION}>
      <Slab as="h2" id="play-feed" label="Feed" />
      <PlayFeed
        entries={side.entries}
        posts={side.dispatch.posts}
        postNow={side.dispatch.postNow}
        canWrite={play.canWrite}
      />
    </section>
  )
}

export function PlaySideColumn({ target, play }: PlayColumnProps) {
  const side = usePlaySide({ target, play })
  return (
    <div style={STACK}>
      <PlayCrewSection target={target} play={play} side={side} />
      <PlayTablesSection target={target} play={play} side={side} />
      <PlayFeedSection target={target} play={play} side={side} />
    </div>
  )
}
