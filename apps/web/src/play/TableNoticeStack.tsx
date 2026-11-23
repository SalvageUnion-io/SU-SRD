/**
 * The table's one strip (`TableNotices`, r6 A1): the Stop Sign, a proposal,
 * whose turn it is, the Mediator's alert and the table's news share it. It
 * shows one (`shownNotices`: the Stop Sign, then what waits on an answer, then
 * the newest), counts the rest behind "N more", which opens them in place, and
 * offers Dismiss all. Controls a notice carries for the whole strip (End my
 * turn) stay on it whichever notice leads, so the turn ends one Tab away
 * (r6 A13). On a Play screen it has one fixed height under the bar
 * (`fixed`), and a notice arriving or leaving moves nothing; "N more" opens
 * the list below it, never over the step it is about (r7 A1). There a notice
 * reads in two lines on a phone, one from `lg`, and a press on its words opens
 * it whole in place, its controls wrapping under them (r8 A1). The ruling's other choice
 * (`stripRuling.model.ts`, `lines`) draws every notice as its own one-line banner.
 */

import { useState } from 'react'
import { Button, Callout, capsLabel, cn, Text, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { NOTICE_LAYOUT } from './stripRuling.model'
import type { StackedNotice } from './tableNotices.model'
import { shownNotices, stackNotices, YOUR_TURN_ID } from './tableNotices.model'

const STRONG = { fontWeight: tokens.weight.bold } satisfies React.CSSProperties

/** One pinned notice, as the strip draws it. */
export type Notice = StackedNotice & {
  /** What `data-table-notice` names it. */
  kind:
    | 'stop'
    | 'removed'
    | 'turn'
    | 'proposal'
    | 'alert'
    | 'role'
    | 'session'
    | 'session-ended'
    | 'event'
    // The viewer's own unit at 0, its Critical roll to make (r7 A1).
    | 'down'
    // A Downtime step waiting on the viewer, off the Play screen (r6 C5).
    | 'downtime'
    // The boarded Mech at its Heat Capacity: the Heat Check is due (r6 A6).
    | 'heat'
  tone: 'ink' | 'pilot' | 'crawler' | 'bad'
  title: string
  body?: string
  /** Its own controls, before Dismiss: Accept and Decline, a door. */
  actions?: React.ReactNode
  /** Controls kept on the strip whichever notice leads it: End my turn (r6 A13). */
  carry?: React.ReactNode
  /** Take it down; absent on one that waits on the viewer. */
  dismiss?: () => void
  /** What makes it a different notice to draw: its words and what its controls allow. */
  sig: string
}

export function NoticeStack({
  notices,
  fixed = false,
  offline,
}: {
  notices: readonly Notice[]
  /** A Play screen's strip: one height, the list opened below it (r6 A1, r7 A1). */
  fixed?: boolean
  /** Offline, the word the strip wears: it still shows, read-only (r6 A14). */
  offline?: string | undefined
}) {
  const [open, setOpen] = useState(false)
  if (NOTICE_LAYOUT === 'lines') {
    return (
      <>
        {stackNotices(notices).map((notice) => (
          <NoticeStrip
            key={notice.key}
            notice={notice}
            line
            offline={offline}
            id={notice.carry !== undefined ? YOUR_TURN_ID : undefined}
          />
        ))}
      </>
    )
  }
  const { top, rest } = shownNotices(notices)
  if (top === null) return null
  // End my turn stays on the strip under whatever leads it (r6 A13).
  const carried = rest.find((notice) => notice.carry !== undefined)
  const clearable = [top, ...rest].filter((notice) => notice.dismiss !== undefined)
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
  const turnId = top.carry !== undefined || carried !== undefined ? YOUR_TURN_ID : undefined
  return (
    <>
      <NoticeStrip
        // A new notice leading the strip opens cut to its lines again.
        key={top.key}
        notice={top}
        line={fixed}
        carried={carried?.carry}
        more={more}
        offline={offline}
        id={turnId}
      />
      {open && rest.length > 0 && (
        <div className="su-table-notices__more">
          {rest.map((notice) => (
            <NoticeStrip key={notice.key} notice={notice} />
          ))}
        </div>
      )}
    </>
  )
}

function NoticeStrip({
  notice,
  carried,
  more,
  line = false,
  offline,
  id,
}: {
  notice: Notice
  /** Another notice's strip-wide controls (End my turn), kept on this one. */
  carried?: React.ReactNode
  more?: React.ReactNode
  /** One line: the title, the body after it on the same line (r6 A1). */
  line?: boolean
  offline?: string | undefined
  id?: string | undefined
}) {
  // Cut to its lines, a press on the words opens the notice whole in place (r8 A1).
  const [whole, setWhole] = useState(false)
  const words = (
    <>
      <Text style={STRONG}>{notice.title}</Text>
      {notice.body !== undefined && <Text>{notice.body}</Text>}
    </>
  )
  return (
    <div
      role="status"
      data-table-notice={notice.kind}
      data-line={line ? '' : undefined}
      data-whole={line && whole ? '' : undefined}
      id={id}
    >
      <Callout tone={notice.tone}>
        <div className="su-table-notice">
          {line ? (
            // A native disclosure: its words are its summary, open it reads whole.
            <details
              className="su-table-notice__words"
              open={whole}
              onToggle={(event) => setWhole(event.currentTarget.open)}
            >
              <summary className="su-table-notice__text">{words}</summary>
            </details>
          ) : (
            <div className="su-table-notice__text">{words}</div>
          )}
          <span className="su-table-notice__actions">
            {offline !== undefined && (
              <span className={cn('su-table-notice__offline', capsLabel({ size: 'badge' }))}>
                {offline}
              </span>
            )}
            {notice.actions ?? notice.carry}
            {carried}
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
