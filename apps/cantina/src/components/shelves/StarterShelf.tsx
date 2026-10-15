/**
 * StarterShelf — the Starter Set as a read-only shelf (Shelves, board S1): the
 * book's ready-made pilots, mechs and crawler, one Token each, as the SRD
 * lists the book's things. Your own units on the shelves above are Rows
 * (`ShelfPill`). They are read like the reference — each opens its read-only
 * sheet (`/starter/:kind/:id`) — and kept by making a copy there ("Make a
 * copy"), never by editing the book's.
 *
 * Its head is every shelf's `Slab`, "read-only" beside the stamp where a
 * shelf of yours says "Yours".
 */

import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
} from 'cantina-domain/starterSet/starterSet'
import { Entity, Slab, Text, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { unitRowModel } from '../../lib/units/unitModel'

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

/** The Slab's own foot margin gives way to the section's gap. */
const SLAB = { marginBottom: 0 } satisfies CSSProperties

const LEAD = { textAlign: 'left' } satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const UNITS: { kind: 'pilot' | 'mech' | 'crawler'; id: string; name: string }[] = [
  ...STARTER_PILOTS.map((p) => ({ kind: 'pilot' as const, id: p.id, name: p.name })),
  ...STARTER_MECHS.map((m) => ({ kind: 'mech' as const, id: m.id, name: m.name })),
  ...STARTER_CRAWLERS.map((c) => ({ kind: 'crawler' as const, id: c.id, name: c.name })),
]

export function StarterShelf() {
  return (
    <section aria-labelledby="shelf-starter" style={SECTION}>
      <Slab
        variant="solid"
        as="h2"
        id="shelf-starter"
        label="Starter Set"
        count="read-only"
        countAt="label"
        style={SLAB}
      />
      <Text variant="body" style={LEAD}>
        The book&rsquo;s ready-made pilots, mechs and crawler. Browse them like the reference; make
        a copy to put one in your own Hangar.
      </Text>
      <ul style={LIST}>
        {UNITS.map((unit) => (
          <li key={unit.id}>
            <Entity
              form="token"
              model={unitRowModel({ kind: unit.kind, name: unit.name })}
              mode={{
                kind: 'link',
                href: `/starter/${unit.kind}/${unit.id}`,
                attrs: { 'aria-label': `Read ${unit.name}` },
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
