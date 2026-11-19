import type { CSSProperties } from 'react'
import { Fragment } from 'react'
import { CITE_SEPARATOR } from 'salvageunion-reference'
import { weight } from '../../design/tokens'
import { InlineRef } from './InlineRef'

const SEPARATOR = { fontWeight: weight.bold } satisfies CSSProperties

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
        {href ? <InlineRef href={href}>{part}</InlineRef> : part}
      </Fragment>
    )
  })
}
