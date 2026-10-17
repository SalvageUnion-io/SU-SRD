import type { ReactNode } from 'react'
import { formatAgo, formatClock, formatDateTime } from '../../lib/formatDate'
import { Eyebrow } from '../atoms/Eyebrow'

type FeedListProps = {
  /** Names the list for a screen reader ("Sent to the table"). */
  label?: string
  children: ReactNode
}

/** FEED LIST — a column of `FeedLine`s, newest first, 6px apart. */
export function FeedList({ label, children }: FeedListProps) {
  return (
    <ul className="su-feed-list" aria-label={label}>
      {children}
    </ul>
  )
}

type FeedLineProps = {
  /** A caps caption over the text: when and who (a roll), or what kind (a change). */
  head?: ReactNode
  /** What the line says. */
  children: ReactNode
  /** Right of the text, wrapping under it when narrow: the time, a state word, actions. */
  end?: ReactNode
  /** A line no longer in force (a superseded proposal): its text struck through. */
  struck?: boolean
}

/**
 * FEED LINE — one entry in a feed: a roll, an alert, a proposal, a change.
 * A paper line in a 1.5px ink-20 frame, its text in body caption; an optional
 * caps head over it and an `end` group at its right. Times go in through
 * `FeedTime`, so every feed writes a time the same way in the format it asks for.
 */
export function FeedLine({ head, children, end, struck = false }: FeedLineProps) {
  return (
    <li className="su-feed-line">
      {head !== undefined && (
        <Eyebrow as="div" tone="muted" className="su-feed-line__head">
          {head}
        </Eyebrow>
      )}
      <div className="su-feed-line__row">
        <div className="su-feed-line__text" data-struck={struck || undefined}>
          {children}
        </div>
        {end !== undefined && <div className="su-feed-line__end">{end}</div>}
      </div>
    </li>
  )
}

type FeedTimeProps = { ts: number } & (
  | {
      /** `clock` "14:05" (a log line), `datetime` a day and a time (a change's history). */
      format: 'clock' | 'datetime'
    }
  | {
      /** `ago` "3 min ago", read against the caller's `now` so a list agrees. */
      format: 'ago'
      now: number
    }
)

/** A feed line's time: a `<time>` in the format its feed reads in (`lib/formatDate`). */
export function FeedTime(props: FeedTimeProps) {
  const text =
    props.format === 'ago'
      ? formatAgo(props.ts, props.now)
      : props.format === 'clock'
        ? formatClock(props.ts)
        : formatDateTime(props.ts)
  return (
    <time className="su-feed-line__time" dateTime={new Date(props.ts).toISOString()}>
      {text}
    </time>
  )
}
