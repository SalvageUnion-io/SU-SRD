/**
 * StarterShelf — the book crews at the foot of the Training Bay, one
 * "Starter crews" shelf (r6 E12): a line on which to try first, then the
 * Quickstart's crew and the Starter Set's, each the same Ledger the signed-out
 * front door shows (`StarterCrewLedger`), folded under its Slab until its
 * fold opens it. Your own
 * builds come first; the book's are reference, read-only, and kept by making a
 * copy from a build's sheet (`/starter/:kind/:id`), never by editing the
 * book's.
 *
 * Its head is every shelf's `Slab`, "read-only" beside the stamp where a
 * shelf of yours says "Yours", and `SlabSection`'s fold at the rule's end.
 */

import type { CSSProperties } from 'react'
import { Slab, SlabSection, tokens } from '../../components/index'
import {
  QUICKSTART_BOOK,
  STARTER_SET_ADVENTURE,
  STARTER_SET_PUBLISHER,
} from '../../lib/starterSet/starterTemplates'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { buildStarterSetCopy } from '../../messages/build-starter-set'
import { StarterCrewLedger } from '../starterSet/StarterCrewLedger'

const PANEL = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
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
      title={buildShelvesCopy('starterCrews')}
      count="read-only"
      countAt="label"
      fold="closed"
      bodyStyle={PANEL}
    >
      {/* One line on which to try first (r6 E12). */}
      <p style={CREDIT}>
        {buildShelvesCopy('starterCrewsLead', {
          book: QUICKSTART_BOOK,
          adventure: STARTER_SET_ADVENTURE,
          publisher: STARTER_SET_PUBLISHER,
        })}
      </p>
      <section aria-label={buildStarterSetCopy('quickstartCrew')} style={PANEL}>
        <Slab as="h3" label={buildStarterSetCopy('quickstartCrew')} flush />
        <StarterCrewLedger roster="quickstart" as="h4" />
      </section>
      <section aria-label={buildStarterSetCopy('starterSet2')} style={PANEL}>
        <Slab as="h3" label={buildStarterSetCopy('starterSet2')} flush />
        <StarterCrewLedger as="h4" />
      </section>
    </SlabSection>
  )
}
