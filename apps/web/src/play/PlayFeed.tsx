/**
 * PlayFeed — the Feed section of the Cockpit's right column (play.md §8): one
 * `FeedList`, built by `playFeedEntries`, of the proposals awaiting my answer,
 * then the crew's rolls, the Mediator's alerts and my own rolls and applied
 * changes, newest first. Solo it is only my own.
 *
 * A proposal answers inline: Accept writes it (`ops.accept`, the owner's
 * own write) and Decline records the answer (`ops.decline`); Decline is
 * a peer of Accept, as on the Game page's inbox (`ProposalInbox`). An accepted
 * one lands on the Feed as the table's line for it, "You accepted: …".
 *
 * Each of my rolls says what became of its Discord post (§9): Posting…,
 * Posted, a Post button for one the toggle kept private (the per-roll
 * override), or Not posted with the reason and Try again. Never silent.
 * One made offline says Not sent yet, with Try again, until it is sent (r5 A6).
 *
 * A Mediator's Opposition roll reaches the players without its names (ADR-051
 * §9b), and a private one not at all: its line here says which and offers
 * Reveal, which shows the table the whole line (`changeLog.reveal`).
 *
 * Feed lines are level 1 (play.md §12): plain text and buttons inside, no
 * frame inside a frame.
 */

import type { CSSProperties } from 'react'
import { FeedLine, FeedList, FeedTime, FieldError } from '../components/app'
import { Button, tokens } from '../components/index'
import { useServerAction } from '../lib/connection/useServerAction'
import { playCopy } from '../messages/play'
import { useTableAct } from '../replica/useTable'
import type { FeedEntry, Kept } from './feed.model'
import type { PlayRoll } from './playRolls.model'
import { acceptedUndo } from './proposalAnswer.model'
import type { PlayPostState } from './usePlayChannel'

const HEAD = { display: 'block', fontWeight: tokens.weight.bold } satisfies CSSProperties

const REASON = { display: 'block', color: tokens.color.wkMuted } satisfies CSSProperties

const ACTIONS = { display: 'flex', gap: tokens.space[6] } satisfies CSSProperties

/** A veiled roll's own row under its line: what the players miss, and Reveal. */
const VEIL = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: tokens.space[6],
} satisfies CSSProperties

const STATE = {
  color: tokens.color.ink75, // design-tokens-ignore(muted-note): a post's status word
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.chip,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

type PlayFeedProps = {
  /** The Game a proposal is answered in; null at the solo table. */
  gameId: string | null
  entries: readonly FeedEntry[]
  /** My rolls' Discord posts, by roll id (`usePlayRollDispatch`). */
  posts: ReadonlyMap<string, PlayPostState>
  /** Post one roll now: Post on a private one, Try again on a failed one. */
  postNow: (roll: PlayRoll) => void
  /** Writes may go: Accept, Decline and Post are offered only then. */
  canWrite: boolean
}

export function PlayFeed({ gameId, entries, posts, postNow, canWrite }: PlayFeedProps) {
  const apply = useTableAct('ops.accept', gameId)
  const decline = useTableAct('ops.decline', gameId)
  const reply = useServerAction((send: () => Promise<unknown>) => send(), {
    failure: playCopy('answerDidNotLand'),
    toastId: 'play-proposal-answer',
  })
  const reveal = useTableAct('changeLog.reveal', gameId)
  const revealing = useServerAction((rollId: string) => reveal({ rollId }), {
    failure: playCopy('revealDidNotLand'),
    toastId: 'play-roll-reveal',
  })
  /** What a kept roll's line says the players miss, and the control that shows it to the table. */
  const veil = (rollId: string | undefined, text: string, kept: Kept | undefined) =>
    rollId === undefined ? null : (
      <span style={VEIL}>
        <span style={STATE}>
          {kept === 'roll' ? playCopy('onlyMediatorSees') : playCopy('namesHidden')}
        </span>
        <Button
          variant="default"
          size="mini"
          disabled={!canWrite}
          aria-label={playCopy('revealWhat', { text })}
          onClick={() => void revealing.run(rollId)}
        >
          {playCopy('reveal')}
        </Button>
      </span>
    )

  // An empty feed says nothing (no explainer line).
  if (entries.length === 0) return null

  const accept = (entry: Extract<FeedEntry, { kind: 'proposal' }>) => {
    void reply
      .run(() => apply({ opId: entry.proposalId }))
      .then((result) => {
        if (!result.ok) return
        // The table's own line says it ("You accepted: …"), once (r3 A5).
        // Theirs to undo, as any change of a live number is (r2 C6).
        acceptedUndo(entry.proposal)
      })
  }

  return (
    <FeedList label={playCopy('feed')}>
      {entries.map((entry) => {
        switch (entry.kind) {
          case 'proposal':
            return (
              <FeedLine
                key={entry.key}
                end={
                  <span style={ACTIONS}>
                    <Button
                      variant="primary"
                      size="mini"
                      disabled={!canWrite}
                      aria-label={playCopy('accept2', { text: entry.text })}
                      onClick={() => accept(entry)}
                    >
                      {playCopy('accept')}
                    </Button>
                    <Button
                      variant="default"
                      size="mini"
                      disabled={!canWrite}
                      aria-label={playCopy('decline2', { text: entry.text })}
                      onClick={() => void reply.run(() => decline({ opId: entry.proposalId }))}
                    >
                      {playCopy('decline')}
                    </Button>
                  </span>
                }
              >
                <span style={HEAD}>{entry.text}</span>
                {entry.reason !== null && <span style={REASON}>“{entry.reason}”</span>}
              </FeedLine>
            )
          case 'mine': {
            const post = posts.get(entry.roll.id)
            return (
              <FeedLine
                key={entry.key}
                end={
                  <PostState post={post} roll={entry.roll} postNow={postNow} canWrite={canWrite} />
                }
              >
                {entry.text}
                {veil(entry.reveal, entry.text, entry.kept)}
                {post?.kind === 'failed' && (
                  <FieldError>
                    {playCopy('notPostedToDiscord', { message: post.message })}
                  </FieldError>
                )}
              </FeedLine>
            )
          }
          default:
            // The table's log reads with its times (a session's record).
            return (
              <FeedLine key={entry.key} end={<FeedTime ts={entry.ts} format="clock" />}>
                {entry.text}
                {entry.kind === 'roll' && veil(entry.reveal, entry.text, entry.kept)}
              </FeedLine>
            )
        }
      })}
    </FeedList>
  )
}

function PostState({
  post,
  roll,
  postNow,
  canWrite,
}: {
  post: PlayPostState | undefined
  roll: PlayRoll
  postNow: (roll: PlayRoll) => void
  canWrite: boolean
}) {
  if (post === undefined || post.kind === 'unbound') return null
  if (post.kind === 'posting') {
    return (
      <span role="status" style={STATE}>
        {playCopy('posting')}
      </span>
    )
  }
  if (post.kind === 'posted') return <span style={STATE}>{playCopy('posted')}</span>
  const label = playCopy('tryAgain')
  if (post.kind === 'held') {
    return (
      <span style={ACTIONS}>
        <span role="status" style={STATE}>
          {playCopy('notSentYet')}
        </span>
        <Button
          variant="default"
          size="mini"
          disabled={!canWrite}
          aria-label={playCopy('sendHeld', { label: roll.label })}
          onClick={() => postNow(roll)}
        >
          {label}
        </Button>
      </span>
    )
  }
  return (
    <Button
      variant="default"
      size="mini"
      disabled={!canWrite}
      aria-label={playCopy('toDiscord', { label, label2: roll.label })}
      onClick={() => postNow(roll)}
    >
      {label}
    </Button>
  )
}
