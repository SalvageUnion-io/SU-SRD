/**
 * StarterShelf — the Starter Set at the foot of the Hangar (board S1): the
 * same grid of cards the signed-out front door shows (`StarterSetGrid`),
 * folded under its Slab until its fold opens it (owner, 2026-10-15). Your own
 * builds come first; the book's are reference, read-only, and kept by making a
 * copy from a build's sheet (`/starter/:kind/:id`), never by editing the
 * book's.
 *
 * Its head is every shelf's `Slab`, "read-only" beside the stamp where a
 * shelf of yours says "Yours", and `SlabSection`'s fold at the rule's end.
 */

import type { CSSProperties } from 'react'
import { SlabSection, tokens } from '../../components/index'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/starterTemplates'
import { StarterSetGrid } from '../starterSet/StarterSetGrid'

const PANEL = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

const CREDIT = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.lede,
  margin: 0,
} satisfies CSSProperties

export function StarterShelf() {
  return (
    <SlabSection
      as="h2"
      id="shelf-starter"
      title="Starter Set"
      count="read-only"
      countAt="label"
      fold="closed"
      bodyStyle={PANEL}
    >
      <p style={CREDIT}>
        The pre-generated crew of <em>{STARTER_SET_ADVENTURE}</em>, by {STARTER_SET_PUBLISHER}. Open
        any sheet to read it, then make a copy to play it.
      </p>
      <StarterSetGrid />
    </SlabSection>
  )
}
