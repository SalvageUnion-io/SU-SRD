/**
 * PlayFeed — the Feed section of the Cockpit's right column (play.md §8): one
 * `FeedList`, built by `playFeedEntries`, of the proposals awaiting my answer,
 * then the crew's rolls, the Mediator's alerts and my own rolls and applied
 * changes, newest first. Solo it is only my own.
 *
 * A proposal answers inline: Accept writes it (`proposals.apply`, the owner's
 * own write) and Decline records the answer (`proposals.decline`); Decline is
 * a peer of Accept, as on the Game page's inbox (`ProposalInbox`). An accepted
 * one lands on the Feed as an applied change.
 *
 * Each of my rolls says what became of its Discord post (§9): Posting…,
 * Posted, a Post button for one the toggle kept private (the per-roll
 * override), or Not posted with the reason and Try again. Never silent.
 *
 * Feed lines are level 1 (play.md §12): plain text and buttons inside, no
 * frame inside a frame.
 */

import { useMutation } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button, EmptyState, FeedLine, FeedList, Message, tokens } from '../components/index'
import { useServerAction } from '../lib/connection/useServerAction'
import { playCopy } from '../messages/play'
import type { FeedEntry } from './feed.model'
import type { PlayRoll } from './playRolls.model'
import { recordPlayChange } from './playRolls.model'
import type { PlayPostState } from './usePlayChannel'

const HEAD = { display: 'block', fontWeight: tokens.weight.bold } satisfies CSSProperties

const REASON = { display: 'block', color: tokens.color.wkMuted } satisfies CSSProperties

const ACTIONS = { display: 'flex', gap: tokens.space[6] } satisfies CSSProperties

const STATE = {
  color: tokens.color.ink75,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

type PlayFeedProps = {
  entries: readonly FeedEntry[]
  /** My rolls' Discord posts, by roll id (`usePlayRollDispatch`). */
  posts: ReadonlyMap<string, PlayPostState>
  /** Post one roll now: Post on a private one, Try again on a failed one. */
  postNow: (roll: PlayRoll) => void
  /** Writes may go: Accept, Decline and Post are offered only then. */
  canWrite: boolean
}

export function PlayFeed({ entries, posts, postNow, canWrite }: PlayFeedProps) {
  const apply = useMutation(api.proposals.apply)
  const decline = useMutation(api.proposals.decline)
  const reply = useServerAction((send: () => Promise<unknown>) => send(), {
    failure: 'Your answer did not land. Try again.',
    toastId: 'play-proposal-answer',
  })

  if (entries.length === 0) {
    return <EmptyState variant="inline" body={playCopy('rollsAndChangesLandHere')} />
  }

  const accept = (entry: Extract<FeedEntry, { kind: 'proposal' }>) => {
    void reply
      .run(() => apply({ proposalId: entry.proposalId as Id<'changeLog'> }))
      .then((result) => {
        if (result.ok) recordPlayChange(`Applied · ${entry.change}`)
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
                      onClick={() =>
                        void reply.run(() =>
                          decline({ proposalId: entry.proposalId as Id<'changeLog'> })
                        )
                      }
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
                {post?.kind === 'failed' && (
                  <Message tone="bad">
                    {playCopy('notPostedToDiscord', { message: post.message })}
                  </Message>
                )}
              </FeedLine>
            )
          }
          default:
            return <FeedLine key={entry.key}>{entry.text}</FeedLine>
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
  const label = post.kind === 'skipped' ? 'Post' : 'Try again'
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
