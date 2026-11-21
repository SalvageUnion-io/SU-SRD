import type { CSSProperties } from 'react'
import { Fragment } from 'react'
import { CITE_SEPARATOR } from 'salvageunion-reference'
import { weight } from '../../design/tokens'
import { InlineRef } from './InlineRef'

const SEPARATOR = { fontWeight: weight.bold } satisfies CSSProperties

/**
 * A linked printing is one box: the line breaks between printings, at a
 * `//`, never inside one, so a wrapped link is no two pieces whose middle
 * is a neighbour's text (a press on it lands on the link, K14).
 */
const PRINTING = { display: 'inline-block' } satisfies CSSProperties

/**
 * A foot's citation line (`citeLine`), each `//` between two printings in
 * bold so the books read apart (ruleset Source 2). The text is unchanged: a
 * reader, a copy and `textContent` get the same line. A printing with an
 * `hrefs` entry links to its book's page (Source 3).
 */
export function CiteLine({
  text,
  hrefs = [],
}: {
  text: string
  /** Each printing's book page, by position; absent, that printing is plain text. */
  hrefs?: readonly (string | undefined)[]
}) {
  const parts = text.split(CITE_SEPARATOR)
  return parts.map((part, i) => {
    const href = hrefs[i]
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: a static split of one line
      <Fragment key={i}>
        {i > 0 && (
          <>
            {' '}
            <span style={SEPARATOR}>{CITE_SEPARATOR.trim()}</span>{' '}
          </>
        )}
        {href ? (
          <InlineRef href={href} style={PRINTING}>
            {part}
          </InlineRef>
        ) : (
          part
        )}
      </Fragment>
    )
  })
}
