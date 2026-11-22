/**
 * A build's Scrap in a narrow cell (r6 E4): `TL1 24 · TL2 2`, from the one
 * formatter (`scrapSplit`'s parts), breaking between Tech Levels and never
 * inside one, so a phone's column stays inside its frame.
 */
import { Fragment } from 'react'

export function ScrapSplit({ parts }: { parts: readonly string[] }) {
  if (parts.length === 0) return ''
  return (
    <span className="su-scrap-split">
      {parts.map((part, at) => (
        <Fragment key={part}>
          {/* The dot goes with the level after it: a line never starts or ends on one alone. */}
          {at > 0 && ' '}
          <span>{at > 0 ? `· ${part}` : part}</span>
        </Fragment>
      ))}
    </span>
  )
}
