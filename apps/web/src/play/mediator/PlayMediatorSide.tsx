/**
 * PlayMediatorSide — the Mediator's right column (play.md §10, wireframe pins
 * 5–6): the player's Tables and Feed sections, then the Propose dock.
 *
 *  - **Tables** (`PlayMediatorTablesSection`): pinned for the Game's state,
 *    Find for the rest, and the screen's Post toggle, private by default for
 *    the Mediator (`postDefault`, `postsByDefault`).
 *  - **Feed** (`PlayMediatorFeedSection`): the crew's rolls and the alerts
 *    sent, with this screen's own rolls (Opposition, Morale, tables), newest
 *    first. Nothing awaits the Mediator's answer, so no proposal waits here.
 *  - **Propose** (`PlayMediatorProposeSection`, `ProposeDock`): the propose
 *    dock, its target the seat tapped on the left; every proposal
 *    sent is a press away (All proposals, `ProposalsList`, twenty at a time).
 *
 * What the sections share is `usePlayMediatorSide`, called once per screen
 * (here, or by the phone form, `PlayMediatorPhone`, which puts the sections
 * on its own tabs). The roll dispatch lives there (`usePlayRollDispatch`),
 * with the Game's log left out: the log is the crew's, and the Opposition
 * reaches them only through what is posted. Headings are Slabs; the dock is a
 * level-1 box.
 */

import { proposalTargets } from 'cantina-domain/games/proposals'
import type { CSSProperties, RefObject } from 'react'
import { useState } from 'react'
import { Button, ModalShell, Slab, tokens } from '../../components/index'
import type { PlayBinding } from '../channels.model'
import { PlayFeed } from '../PlayFeed'
import { PlayTables } from '../PlayTables'
import { ProposalsList } from './ProposalsList'
import { ProposeDock } from './ProposeDock'
import type { PlayMediator } from './usePlayMediator'
import type { PlayMediatorSideState } from './usePlayMediatorSide'
import { usePlayMediatorSide } from './usePlayMediatorSide'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  minHeight: '100%',
} satisfies CSSProperties

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

/** The dock sits at the column's foot, as the wireframe draws it. */
const DOCK = { ...SECTION, marginTop: 'auto' } satisfies CSSProperties

const ALL = { alignSelf: 'flex-end' } satisfies CSSProperties

type SectionProps = { mediator: PlayMediator; side: PlayMediatorSideState }

/** Tables, pinned for the Game's state, and the Post toggle. */
export function PlayMediatorTablesSection({ mediator, side }: SectionProps) {
  return (
    <section aria-labelledby="mediate-tables" style={SECTION}>
      <Slab variant="solid" as="h2" id="mediate-tables" label="Tables" />
      <PlayTables
        downtime={mediator.downtime.downtime.running}
        solo={false}
        post={side.post}
        onPostChange={side.setPost}
        binding={side.binding}
      />
    </section>
  )
}

/** The Feed: the crew's rolls and the alerts sent, with this screen's own. */
export function PlayMediatorFeedSection({ mediator, side }: SectionProps) {
  return (
    <section aria-labelledby="mediate-feed" style={SECTION}>
      <Slab variant="solid" as="h2" id="mediate-feed" label="Feed" />
      <PlayFeed
        entries={side.entries}
        posts={side.dispatch.posts}
        postNow={side.dispatch.postNow}
        canWrite={mediator.canWrite}
      />
    </section>
  )
}

type ProposeProps = {
  mediator: PlayMediator
  /** The pilot row Propose is aimed at (a seat sets it). */
  targetId: string | null
  onTarget: (id: string | null) => void
  /** Propose's To field, which picking a seat focuses. */
  toRef: RefObject<HTMLInputElement | null>
  /** Sits at the foot of its column, as the canvas's wireframe draws it. */
  docked?: boolean
}

/** The Propose dock, and every proposal sent a press away. */
export function PlayMediatorProposeSection({
  mediator,
  targetId,
  onTarget,
  toRef,
  docked = false,
}: ProposeProps) {
  const [allOpen, setAllOpen] = useState(false)
  return (
    <section aria-label="Propose" style={docked ? DOCK : SECTION}>
      <ProposeDock
        targets={proposalTargets(mediator.crew)}
        targetId={targetId}
        onTarget={onTarget}
        recent={(mediator.sent ?? []).slice(0, 3)}
        now={mediator.now}
        canWrite={mediator.canWrite}
        onPropose={mediator.propose}
        toRef={toRef}
      />
      <Button variant="ghost" size="mini" style={ALL} onClick={() => setAllOpen(true)}>
        All proposals
      </Button>
      <ModalShell
        open={allOpen}
        onOpenChange={setAllOpen}
        title="Proposals you sent"
        maxWidth="su-play-dialog"
      >
        <ProposalsList
          proposals={mediator.sent}
          limit={mediator.sentLimit}
          now={mediator.now}
          onMore={mediator.moreSent}
        />
      </ModalShell>
    </section>
  )
}

type PlayMediatorSideProps = Omit<ProposeProps, 'docked'> & {
  binding: PlayBinding | null | undefined
}

export function PlayMediatorSide({
  mediator,
  binding,
  targetId,
  onTarget,
  toRef,
}: PlayMediatorSideProps) {
  const side = usePlayMediatorSide(mediator, binding)
  return (
    <div style={STACK}>
      <PlayMediatorTablesSection mediator={mediator} side={side} />
      <PlayMediatorFeedSection mediator={mediator} side={side} />
      <PlayMediatorProposeSection
        mediator={mediator}
        targetId={targetId}
        onTarget={onTarget}
        toRef={toRef}
        docked
      />
    </div>
  )
}
