// A Page's short list of links back, in its side column: the roll tables an
// entry is rolled on (`lib/pageRelations.ts`), a compact cut-out box under the
// art (or in a sparse Page's rail), never a full-width band. Every entry is a
// term (E27): a real link to its page, so the keyboard reaches it and it
// works with no script.
import type { CSSProperties } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { space } from '../design/tokens'
import { TitledBox } from './containers/TitledBox'
import { Mention } from './entity/forms/Mention'

/** A side list as the page hands it: its title, its band's tone and its links. */
export type SideLinkList = {
  label: string
  tone: string
  rows: readonly { ref: EntityRef; name: string }[]
}

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

export function SideLinks({ list, className }: { list: SideLinkList; className?: string }) {
  if (list.rows.length === 0) return null
  return (
    <TitledBox title={list.label} titleAs="h2" tone={list.tone} className={className}>
      <ul style={LIST}>
        {list.rows.map((row) => (
          <li key={`${row.ref.schemaName}:${row.ref.id}`}>
            <Mention entityRef={row.ref} goes>
              {row.name}
            </Mention>
          </li>
        ))}
      </ul>
    </TitledBox>
  )
}
