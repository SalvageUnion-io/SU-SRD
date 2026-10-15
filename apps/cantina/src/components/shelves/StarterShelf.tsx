/**
 * StarterShelf — the Starter Set at the foot of the Hangar (board S1): the
 * same grid of cards the signed-out front door shows (`StarterSetGrid`),
 * folded under its Slab until "Show" opens it (owner, 2026-10-15). Your own
 * builds come first; the book's are reference, read-only, and kept by making a
 * copy from a build's sheet (`/starter/:kind/:id`), never by editing the
 * book's.
 *
 * Its head is every shelf's `Slab`, "read-only" beside the stamp where a
 * shelf of yours says "Yours", and the fold's toggle at the rule's end.
 */

import { Button, Slab, tokens, useDisclosure } from 'component-lib'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CSSProperties } from 'react'
import { STARTER_SET_ADVENTURE, STARTER_SET_PUBLISHER } from '../../lib/starterSet/starterTemplates'
import { StarterSetGrid } from '../starterSet/StarterSetGrid'

const SECTION = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

/** The Slab's own foot margin gives way to the section's gap. */
const SLAB = { marginBottom: 0 } satisfies CSSProperties

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
  const fold = useDisclosure()
  const Chevron = fold.open ? ChevronUp : ChevronDown
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
        actions={
          <Button
            size="compact"
            className="su-shelves-action"
            aria-label={fold.open ? 'Hide the Starter Set' : 'Show the Starter Set'}
            {...fold.toggleProps}
          >
            {fold.open ? 'Hide' : 'Show'}
            <Chevron size={14} aria-hidden="true" />
          </Button>
        }
      />
      <div id={fold.panelId} hidden={!fold.open} style={PANEL}>
        {fold.open && (
          <>
            <p style={CREDIT}>
              The pre-generated crew of <em>{STARTER_SET_ADVENTURE}</em>, by {STARTER_SET_PUBLISHER}
              . Open any sheet to read it, then make a copy to play it.
            </p>
            <StarterSetGrid />
          </>
        )}
      </div>
    </section>
  )
}
