/**
 * SheetHero — the sheet's opening region (Workshop-Manual identity band):
 * a wide "thick" card of identity FIELDS beside a narrow "long" card of
 * current/max GAUGES. There is no name stamp here: the name is the chapter
 * band's notched `<h1>` above it (`LiveSheet`).
 *
 * Pure layout — all content arrives via slots so the four sheets (pilot, mech,
 * crawler, NPC) compose it without forking the frame (hard rule R11).
 */

import type { CSSProperties, ReactNode } from 'react'
import { SheetSectionCard } from '../../components/index'

/** The grid's columns and gap step up with the sheet's width (`.su-sheet-hero`). */
const GRID = { display: 'grid' } satisfies CSSProperties

/** The vitals stack; the deep-tone rule between its rows is `.su-sheet-vitals`. */
const VITALS = { display: 'flex', flexDirection: 'column', width: '100%' } satisfies CSSProperties

type SheetHeroProps = {
  name: string
  /**
   * The identity FIELDS card body. Both cards are `SheetSectionCard`s — the
   * ONLY framed sections on a live sheet. Every section BELOW them is a slab,
   * so the frame marks the opening region rather than repeating down the
   * page. The edge wordmark is NOT here: it belongs to the page gutter
   * (`LiveSheet`), outside the content column, so it differentiates the sheet
   * without occupying it.
   */
  fields: ReactNode
  /**
   * The current/max gauges (`SheetVitalGauge`) and the rows that go with them
   * (Training Points, Conditions): the narrow "long" card, one stack every
   * kind shares (`.su-sheet-vitals`), a rule between each row.
   */
  vitals?: ReactNode
  /** The vitals card's action chips (a crawler's Pay / Fund / Trade), on its head. */
  vitalsActions?: ReactNode
  /** Title of the fields card. */
  fieldsTitle?: string
}

export function SheetHero({
  name,
  fields,
  vitals,
  vitalsActions,
  fieldsTitle = 'Identity',
}: SheetHeroProps) {
  return (
    <section
      aria-label={`${name} sheet header`}
      // The gauges card is content-width ("long" — a narrow tall column);
      // the fields card takes the rest ("thick"). They stack on narrow
      // viewports so neither ever crushes.
      //
      // No `align-items: start`: grid items stretch by default, so the two
      // cards are always the SAME height whichever one is taller. `Card` is a
      // flex column with a growing body, so the shorter card grows its paper body
      // rather than leaving the frame short and the row ragged.
      className="su-sheet-hero"
      style={GRID}
    >
      {/* The OPENING sections are the only ones that keep a card container:
          they are the sheet's subject and its live state, so they read as
          framed objects. Everything below them is a slab. They do not fold —
          a card has no chevron, which is exactly right here. */}
      <SheetSectionCard
        title={fieldsTitle}
        // One surface in Read and Edit (owner's call, 2026-10-14: Edit looks
        // like Read), so switching modes never reframes the page.
        className="su-sheet-hero-fields"
        bodyClassName="su-sheet-hero-fields-body"
      >
        {fields}
      </SheetSectionCard>
      {vitals && (
        <SheetSectionCard title="Vitals" actions={vitalsActions}>
          <div className="su-sheet-vitals" style={VITALS}>
            {vitals}
          </div>
        </SheetSectionCard>
      )}
    </section>
  )
}
