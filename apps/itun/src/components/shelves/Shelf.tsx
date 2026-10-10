/**
 * Shelf — one kind of thing you keep (Shelves, board S1): the section stamp
 * with its count beside it, a dashed rule running to the shelf's "+ New…"
 * control, a line saying what the shelf is for where it needs one, and the
 * items, or a line saying there are none.
 *
 * The region is named by its stamp, so "Pilots" is both what a reader sees and
 * what a screen reader lands on.
 */

import { Slab, Text, tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  // The slab brings its own foot margin.
  gap: tokens.space[4],
  minWidth: 0,
} satisfies CSSProperties

const NOTE = { textAlign: 'left' } satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const EMPTY = { textAlign: 'left' } satisfies CSSProperties

type ShelfProps = {
  /** The stamp, and the region's name: "Pilots". */
  title: string
  /** Its id, for `aria-labelledby`. */
  id: string
  /** Beside the stamp: "3", or "2 · yours". */
  count: ReactNode
  /** At the rule's end: the shelf's "+ New…" control. */
  action?: ReactNode
  /** What the shelf is for, under the stamp. */
  note?: ReactNode
  /** Shown when there are no items. */
  empty: ReactNode
  /** The items, as `ShelfItem`s. */
  children?: ReactNode
  /** Whether there are none to list. */
  isEmpty: boolean
}

export function Shelf({ title, id, count, action, note, empty, children, isEmpty }: ShelfProps) {
  return (
    <section aria-labelledby={id} style={SECTION}>
      <Slab
        variant="solid"
        as="h2"
        id={id}
        label={title}
        count={count}
        countAt="label"
        actions={action}
      />
      {note && (
        <Text variant="hint" style={NOTE}>
          {note}
        </Text>
      )}
      {isEmpty ? (
        <Text variant="hint" style={EMPTY}>
          {empty}
        </Text>
      ) : (
        <ul style={LIST}>{children}</ul>
      )}
    </section>
  )
}
