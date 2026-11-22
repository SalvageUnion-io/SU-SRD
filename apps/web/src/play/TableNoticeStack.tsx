/**
 * The pinned notices' strips (`TableNotices`, r3 H1): the Mediator's alert, a
 * strip of its own that nothing folds away (r4 B2), then the one strip the
 * rest share: the first of them (`shownNotices`), with how many more wait
 * behind a button that lists them, and Dismiss all for those that can be
 * dismissed. One notice is just itself.
 */

import { useState } from 'react'
import { Button, Callout, Text, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import type { StackedNotice } from './tableNotices.model'
import { shownNotices } from './tableNotices.model'

const STRONG = { fontWeight: tokens.weight.bold } satisfies React.CSSProperties

/** One pinned notice, as the strip draws it. */
export type Notice = StackedNotice & {
  /** What `data-table-notice` names it. */
  kind: 'removed' | 'turn' | 'proposal' | 'alert' | 'role' | 'session' | 'session-ended'
  tone: 'ink' | 'pilot' | 'crawler'
  title: string
  body?: string
  /** Its own controls, before Dismiss: Accept and Decline, a door. */
  actions?: React.ReactNode
  /** Take it down; absent on one that waits on the viewer. */
  dismiss?: () => void
  /** What makes it a different notice to draw: its words and what its controls allow. */
  sig: string
}

export function NoticeStack({ notices }: { notices: readonly Notice[] }) {
  const [open, setOpen] = useState(false)
  const { alerts, top, rest } = shownNotices(notices)
  // The Mediator's word is never folded away (r4 B2): above the strip, each its own.
  const told = alerts.map((notice) => <NoticeStrip key={notice.key} notice={notice} />)
  if (top === null) return <>{told}</>
  const clearable = [...alerts, top, ...rest].filter((notice) => notice.dismiss !== undefined)
  const more =
    rest.length === 0 ? null : (
      <>
        <Button
          size="compact"
          aria-expanded={open}
          aria-label={
            open
              ? playCopy('showFewerNotices')
              : playCopy('showMoreNotices', { count: rest.length })
          }
          onClick={() => setOpen(!open)}
        >
          {open ? playCopy('showFewer') : playCopy('moreNotices', { count: rest.length })}
        </Button>
        {clearable.length > 0 && (
          <Button
            size="compact"
            onClick={() => {
              for (const notice of clearable) notice.dismiss?.()
            }}
          >
            {playCopy('dismissAll')}
          </Button>
        )}
      </>
    )
  return (
    <>
      {told}
      <NoticeStrip notice={top} more={more} />
      {open && rest.map((notice) => <NoticeStrip key={notice.key} notice={notice} />)}
    </>
  )
}

function NoticeStrip({ notice, more }: { notice: Notice; more?: React.ReactNode }) {
  return (
    <div role="status" data-table-notice={notice.kind}>
      <Callout tone={notice.tone}>
        <div className="su-table-notice">
          <div className="su-table-notice__text">
            <Text style={STRONG}>{notice.title}</Text>
            {notice.body !== undefined && <Text>{notice.body}</Text>}
          </div>
          <span className="su-table-notice__actions">
            {notice.actions}
            {notice.dismiss !== undefined && (
              <Button
                size="compact"
                aria-label={playCopy('dismissWhat', { what: notice.title })}
                onClick={notice.dismiss}
              >
                {playCopy('dismiss')}
              </Button>
            )}
            {more}
          </span>
        </div>
      </Callout>
    </div>
  )
}
