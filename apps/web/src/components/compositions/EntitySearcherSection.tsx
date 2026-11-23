/**
 * EntitySearcherSection — a named run of rows after the searcher's list: what
 * the search names in a Tech Level switched off (r4 E5), and the rows a pick
 * does not meet yet (`facets.later`, r7 D5). Its head is the summary line's
 * caps, set off the list above; its rows open no hover card over the rows
 * under them, as the list's own do in a picker.
 */

import type { CSSProperties, ReactNode } from 'react'
import { space } from '../../design/tokens'
import { InsidePeekContext } from '../atoms/insidePeek'
import { PeekOffContext } from '../entity/peekContext'
import { SUMMARY_CAPS, SUMMARY_STYLE } from './entitySearcherStyles.model'

const HEAD_STYLE = {
  ...SUMMARY_STYLE,
  margin: `${space[12]} 0 ${space[6]}`,
} satisfies CSSProperties

export function EntitySearcherSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label}>
      <p className={SUMMARY_CAPS} style={HEAD_STYLE}>
        {label}
      </p>
      <InsidePeekContext.Provider value>
        <PeekOffContext.Provider value>
          <div className="su-searcher__list">{children}</div>
        </PeekOffContext.Provider>
      </InsidePeekContext.Provider>
    </section>
  )
}
