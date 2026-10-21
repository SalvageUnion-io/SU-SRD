/**
 * PlayMediatorSide — the Mediator's right column (play.md §10, wireframe pins
 * 5–6): the player's Tables and Feed sections, then the Propose dock.
 *
 *  - **Tables** (`PlayTablesSection`, the player's): pinned for the Game's
 *    state, Find for the rest, and the screen's Post toggle, private by
 *    default for the Mediator (`postDefault`, `postsByDefault`).
 *  - **Feed** (`PlayFeedSection`, the player's): the crew's rolls and the alerts
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

import { proposalTargets } from 'game-domain/games/proposals'
import type { CSSProperties, RefObject } from 'react'
import { useState } from 'react'
import { Button, ModalShell, tokens } from '../../components/index'
import type { PlayBinding } from '../channels.model'
import { PlayFeedSection, PlayTablesSection } from '../PlaySideColumn'
import type { SideFeed } from '../usePlaySide'
import { ProposalsList } from './ProposalsList'
import { ProposeDock } from './ProposeDock'
import type { PlayMediator } from './usePlayMediator'
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

/** The Mediator's Tables and Feed sections, as the canvas and the phone's Tables tab stack them. */
export function MediatorTablesAndFeed({
  mediator,
  side,
}: {
  mediator: PlayMediator
  side: SideFeed
}) {
  return (
    <>
      <PlayTablesSection
        side={side}
        idPrefix="mediate"
        downtime={mediator.downtime.downtime.running}
        solo={false}
      />
      <PlayFeedSection side={side} idPrefix="mediate" canWrite={mediator.canWrite} />
    </>
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
        // The dock's last chip (C8, hard rule R6), never a line under it.
        controls={
          <Button size="mini" onClick={() => setAllOpen(true)}>
            All proposals
          </Button>
        }
      />
      <ModalShell
        open={allOpen}
        onOpenChange={setAllOpen}
        title="Proposals you sent"
        width="default"
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
      <MediatorTablesAndFeed mediator={mediator} side={side} />
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
