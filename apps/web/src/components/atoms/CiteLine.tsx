import type { CSSProperties } from 'react'
import { Fragment } from 'react'
import { CITE_SEPARATOR } from 'salvageunion-reference'
import { weight } from '../../design/tokens'

const SEPARATOR = { fontWeight: weight.bold } satisfies CSSProperties

/**
 * A foot's citation line (`citeLine`), each `//` between two printings in
 * bold so the books read apart (ruleset Source 2). The text is unchanged: a
 * reader, a copy and `textContent` get the same line.
 */
export function CiteLine({ text }: { text: string }) {
  const parts = text.split(CITE_SEPARATOR)
  return parts.map((part, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a static split of one line
    <Fragment key={i}>
      {i > 0 && (
        <>
          {' '}
          <span style={SEPARATOR}>{CITE_SEPARATOR.trim()}</span>{' '}
        </>
      )}
      {part}
    </Fragment>
  ))
}
