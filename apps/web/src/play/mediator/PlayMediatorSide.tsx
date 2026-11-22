/**
 * PlayMediatorSide — the Mediator's end column's panes (play.md §10): the running encounter's Notes, the player's Tables and Feed sections (the Tables pane), then the Propose dock (the Propose pane).
 *
 *  - **Briefing** (ADR-059 §5; `RunningNotes`, on the Opposition tab below `lg`): the running encounter's, what the Pilots
 *    see, and Send the briefing, which sends it as an alert. Shown only while
 *    one with a briefing is running, behind the `encounterSheet` flag.
 *  - **Notes** (ADR-059): the running encounter's, the Mediator's alone,
 *    shown only while one with notes is running.
 *
 *  - **Tables** (`PlayTablesSection`, the player's): the running encounter's,
 *    then those pinned for the Game's state, Find for the rest, and where the
 *    screen's rolls post: every roll, while a channel is bound.
 *  - **Feed** (`PlayFeedSection`, the player's): the crew's rolls and the alerts
 *    sent, with this screen's own rolls (Opposition, Morale, tables), newest
 *    first. Nothing awaits the Mediator's answer, so no proposal waits here.
 *  - **Propose** (`PlayMediatorProposeSection`, `ProposeDock`): the propose
 *    dock, its target the seat tapped on the left; every proposal
 *    sent is a press away (All proposals, `ProposalsList`, twenty at a time).
 *
 * What the sections share is the side's `useSideFeed`, called once per screen
 * by `PlayMediatorCockpit`. The roll dispatch lives there (`usePlayRollDispatch`):
 * each roll goes on the Game's log, private while the Rolls head's switch is on.
 * Headings are Slabs; the dock is a level-1 box.
 */

import { proposalTargets } from 'game-domain/games/proposals'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useState } from 'react'
import { Button, ModalShell, SlabSection, Stat, tokens } from '../../components/index'
import { flagOn } from '../../lib/flags'
import { mediatorCopy } from '../../messages/play-mediator'
import { PlayTablesSection } from '../PlaySideColumn'
import type { SideFeed } from '../usePlaySide'
import { MUTED } from './mediatorStyles.model'
import { ProposalsList } from './ProposalsList'
import { ProposeDock } from './ProposeDock'
import { RunningBriefing } from './RunningBriefing'
import type { PlayMediator } from './usePlayMediator'

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  minWidth: 0,
} satisfies CSSProperties

/** The crawler's line in Propose: why it is not a target, then the way to its SP. */
const CRAWLER_NOTE = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

const MUTED_NOTE = { ...MUTED, margin: 0 } satisfies CSSProperties

/** The running encounter's notes (ADR-059), as the Mediator wrote them. */
const NOTES = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.body,
  lineHeight: 1.45,
  margin: 0,
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-line',
} satisfies CSSProperties

/**
 * The running encounter's Briefing and Notes. From `lg` they head the end
 * column; on a phone they stand on the Opposition tab, under the encounter's
 * name (r4 D3), where the Mediator looks for them.
 */
export function RunningNotes({ mediator }: { mediator: PlayMediator }) {
  const running = mediator.prep.running
  const briefing = flagOn('encounterSheet') ? (running?.briefing ?? '') : ''
  return (
    <>
      {briefing !== '' && (
        <RunningBriefing
          briefing={briefing}
          canWrite={mediator.canWrite}
          onTell={mediator.broadcast}
        />
      )}
      {running !== null && running.notes.trim() !== '' && (
        <SlabSection
          as="h2"
          id="mediate-notes"
          title={mediatorCopy('notes')}
          actions={<Stat label={mediatorCopy('onlyYou')} size="compact" />}
        >
          <p style={NOTES}>{running.notes}</p>
        </SlabSection>
      )}
    </>
  )
}

/** The Mediator's Tables and Feed sections: the Tables pane. */
export function MediatorTablesAndFeed({
  mediator,
  side,
  actions,
  notes = true,
}: {
  mediator: PlayMediator
  side: SideFeed
  /** The Rolls head's own control: the Private rolls switch. */
  actions?: ReactNode
  /** The running encounter's Briefing and Notes head the pane (off where the Opposition tab holds them). */
  notes?: boolean
}) {
  const running = mediator.prep.running
  return (
    <>
      {notes ? <RunningNotes mediator={mediator} /> : null}
      <PlayTablesSection
        side={side}
        idPrefix="mediate"
        downtime={mediator.downtime.downtime.running}
        solo={false}
        prepared={running?.tables}
        onField={mediator.canWrite ? mediator.tray.field : undefined}
        actions={actions}
      />
      {/* The Feed sits under the Table (`PlayMediatorCockpit`), where the
          column was empty, so Tables runs straight into Propose. */}
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
  /** Go to the crawler's SP on the Table, for a direct change (r6 B13). */
  onCrawler?: () => void
}

/** The Propose dock, and every proposal sent a press away. */
export function PlayMediatorProposeSection({
  mediator,
  targetId,
  onTarget,
  toRef,
  onCrawler,
}: ProposeProps) {
  const [allOpen, setAllOpen] = useState(false)
  // The crawler is the table runner's to write, never a player's to answer (ADR-038 §5).
  const crawler = mediator.crawler?.held ? mediator.crawler.crawler : null
  return (
    <section aria-label={mediatorCopy('propose')} style={SECTION}>
      <ProposeDock
        targets={proposalTargets(mediator.crew)}
        targetId={targetId}
        onTarget={onTarget}
        recent={(mediator.sent ?? []).slice(0, 3)}
        now={mediator.now}
        canWrite={mediator.canWrite}
        onPropose={mediator.propose}
        onWithdraw={mediator.withdraw}
        toRef={toRef}
        note={
          crawler !== null ? (
            <div style={CRAWLER_NOTE}>
              <p style={MUTED_NOTE}>{mediatorCopy('crawlerIsYours', { name: crawler.name })}</p>
              {onCrawler && (
                <Button size="mini" onClick={onCrawler}>
                  {mediatorCopy('toItsSp')}
                </Button>
              )}
            </div>
          ) : undefined
        }
        // The dock's last chip (C8), never a line under it.
        controls={
          <Button size="mini" onClick={() => setAllOpen(true)}>
            {mediatorCopy('allProposals')}
          </Button>
        }
      />
      <ModalShell
        open={allOpen}
        onOpenChange={setAllOpen}
        title={mediatorCopy('proposalsYouSent')}
        width="default"
      >
        <ProposalsList
          proposals={mediator.sent}
          limit={mediator.sentLimit}
          now={mediator.now}
          onMore={mediator.moreSent}
          onWithdraw={mediator.canWrite ? mediator.withdraw : undefined}
        />
      </ModalShell>
    </section>
  )
}
