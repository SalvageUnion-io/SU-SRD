/**
 * SheetHero — the sheet's opening region (Workshop-Manual identity band):
 * a wide "thick" card of identity FIELDS beside a narrow "long" card of
 * current/max GAUGES. There is no name stamp here: the name is the chapter
 * band's notched `<h1>` above it (`LiveSheet`, board 10).
 *
 * Pure layout — all content arrives via slots so the three variant sheets
 * compose it without forking the frame.
 */

import { cn, SheetSectionCard } from 'component-lib'
import type { ReactNode } from 'react'

type SheetHeroProps = {
  name: string
  /** Header-right count/pill slot of the fields card (e.g. a Dead badge). */
  meta?: ReactNode
  /**
   * The identity FIELDS card body. Both cards are `SheetSectionCard`s — the
   * ONLY framed sections on a live sheet. Every section BELOW them is a slab,
   * so the frame marks the opening region rather than repeating down the
   * page. The edge wordmark is NOT here: it belongs to the page gutter
   * (`LiveSheet`), outside the content column, so it differentiates the sheet
   * without occupying it.
   */
  fields: ReactNode
  /** The current/max gauge card (the narrow "long" one). */
  vitals?: ReactNode
  /** Title of the fields card. */
  fieldsTitle?: string
  className?: string
}

export function SheetHero({
  name,
  meta,
  fields,
  vitals,
  fieldsTitle = 'Identity',
  className,
}: SheetHeroProps) {
  return (
    <section
      aria-label={`${name} sheet header`}
      // The gauges card is content-width ("long" — a narrow tall column);
      // the fields card takes the rest ("thick"). They stack on narrow
      // viewports so neither ever crushes.
      //
      // No `items-start`: grid items stretch by default, so the two cards are
      // always the SAME height whichever one is taller. `Card` is a flex
      // column with a `flex-1` body, so the shorter card grows its paper body
      // rather than leaving the frame short and the row ragged.
      className={cn(
        'grid grid-cols-1 gap-[22px] @3xl:grid-cols-[minmax(0,1fr)_260px] @3xl:gap-6',
        className
      )}
    >
      {/* The OPENING sections are the only ones that keep a card container:
          they are the sheet's subject and its live state, so they read as
          framed objects. Everything below them is a slab. They do not fold —
          a card has no chevron, which is exactly right here. */}
      <SheetSectionCard
        title={fieldsTitle}
        count={meta}
        className="flex h-full flex-col"
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
        {fields}
      </SheetSectionCard>
      {vitals && <SheetSectionCard title="Vitals">{vitals}</SheetSectionCard>}
    </section>
  )
}
