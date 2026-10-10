/**
 * StarterShelf — the Starter Set as a read-only shelf, in the rules blue
 * (Shelves, board S1): the book's ready-made pilots, mechs and crawler, one
 * button each. They are read like the reference — each opens its read-only
 * sheet (`/starter/:kind/:id`) — and kept by making a copy there ("Make a
 * copy", issue 1255), never by editing the book's.
 *
 * The stamp is rules blue rather than ink because these are the book's, not
 * yours: the same colour map that bands the SRD's rules pages (ruleset, "The
 * source").
 */

import { buttonVariants, Text, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS } from '../../lib/starterSet/starterSet'
import { AppLink } from '../shared/AppLink'

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

const HEAD = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[12],
} satisfies CSSProperties

/** The section stamp in the rules blue: ink on blue, as the rules band carries it. */
const STAMP = {
  backgroundColor: tokens.color.wkLine,
  borderColor: tokens.color.ink,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.hairline,
  color: tokens.color.ink,
  flexShrink: 0,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.sm,
  fontWeight: tokens.weight.extrabold,
  letterSpacing: tokens.tracking.capsTight,
  lineHeight: 1.6,
  margin: 0,
  padding: `2px ${tokens.space[8]} 3px`,
  textTransform: 'uppercase',
} satisfies CSSProperties

const READ_ONLY = {
  color: tokens.color.wkMuted,
  flexShrink: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.xs,
  fontWeight: tokens.weight.bold,
} satisfies CSSProperties

const RULE = {
  borderTopColor: tokens.color.ink50,
  borderTopStyle: 'dashed',
  borderTopWidth: tokens.borderWidth.hairline,
  flex: '1 1 auto',
  height: 0,
  minWidth: tokens.space[12],
} satisfies CSSProperties

const LEAD = { textAlign: 'left' } satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const LINK = { textDecoration: 'none' } satisfies CSSProperties

const UNITS = [
  ...STARTER_PILOTS.map((p) => ({ kind: 'pilot', id: p.id, name: p.name })),
  ...STARTER_MECHS.map((m) => ({ kind: 'mech', id: m.id, name: m.name })),
  ...STARTER_CRAWLERS.map((c) => ({ kind: 'crawler', id: c.id, name: c.name })),
]

export function StarterShelf() {
  return (
    <section aria-labelledby="shelf-starter" style={SECTION}>
      <div style={HEAD}>
        <h2 id="shelf-starter" style={STAMP}>
          Starter Set
        </h2>
        <span style={READ_ONLY}>read-only</span>
        <span aria-hidden="true" style={RULE} />
      </div>
      <Text variant="body" style={LEAD}>
        The book&rsquo;s ready-made pilots, mechs and crawler. Browse them like the reference; make
        a copy to put one on your own shelf.
      </Text>
      <ul style={LIST}>
        {UNITS.map((unit) => (
          <li key={unit.id}>
            <AppLink
              href={`/starter/${unit.kind}/${unit.id}`}
              aria-label={`Read ${unit.name}`}
              className={`${buttonVariants({ size: 'compact' })} shelves-starter__btn`}
              style={LINK}
            >
              {unit.name}
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
