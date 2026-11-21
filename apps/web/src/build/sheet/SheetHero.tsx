/**
 * SheetHero — the sheet's opening region (Workshop-Manual identity band):
 * a wide "thick" card of identity FIELDS beside a narrow "long" card of
 * current/max GAUGES. There is no name stamp here: the name is the chapter
 * band's notched `<h1>` above it (`LiveSheet`).
 *
 * The NPC sheet's opening (R11: the pilot, mech and crawler sheets are their
 * dashboards). Pure layout: all content arrives via slots.
 */

import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Box } from '../../components/index'
import { space, widthAtLeast } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { buildSheetCopy } from '../../messages/build-sheet'
import { useAsideVitalsSlot } from './useAsideVitalsSlot'

/** The grid's columns and gap step up with the sheet's width (`.su-sheet-hero`). */
const GRID = { display: 'grid' } satisfies CSSProperties

/** An opening panel's body: wider than a Box's, as the sheet's content asks. */
const PANEL_BODY = { padding: `${space[16]} ${space[20]}` } satisfies CSSProperties

/** The vitals stack; the deep-tone rule between its rows is `.su-sheet-vitals`. */
const VITALS = { display: 'flex', flexDirection: 'column', width: '100%' } satisfies CSSProperties

type SheetHeroProps = {
  name: string
  /**
   * The identity FIELDS card body. Both cards are hairline `Box`es (R49) — the
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
  /** Title of the fields card. */
  fieldsTitle?: string
}

export function SheetHero({ name, fields, vitals, fieldsTitle = 'Identity' }: SheetHeroProps) {
  // From the 64rem rung, with a sidebar, the Vitals panel heads it (one
  // render, wherever it stands).
  const asideSlot = useAsideVitalsSlot()
  const wide = useMediaQuery(widthAtLeast('lg'), false)
  const inAside = wide && asideSlot !== null
  const vitalsPanel = vitals && (
    <SheetPanel title={buildSheetCopy('vitals')}>
      <div className="su-sheet-vitals" style={VITALS}>
        {vitals}
      </div>
    </SheetPanel>
  )
  return (
    <section
      aria-label={buildSheetCopy('sheetHeader', { name })}
      // The gauges card is content-width ("long" — a narrow tall column);
      // the fields card takes the rest ("thick"). They stack on narrow
      // viewports so neither ever crushes. Each is as tall as its content
      // (`align-items: start`, R61): a card stretched to its
      // neighbour is paper with nothing on it.
      className="su-sheet-hero"
      style={GRID}
    >
      {/* The OPENING sections are the only ones that keep a card container:
          they are the sheet's subject and its live state, so they read as
          framed objects. Everything below them is a slab. They do not fold —
          a card has no chevron, which is exactly right here. */}
      <SheetPanel
        title={fieldsTitle}
        // One surface in Read and Edit (Edit looks like Read), so switching
        // modes never reframes the page.
        className="su-sheet-hero-fields"
        stackClassName="su-sheet-hero-fields-body"
      >
        {fields}
      </SheetPanel>
      {vitalsPanel && !inAside && vitalsPanel}
      {vitalsPanel && inAside && createPortal(vitalsPanel, asideSlot)}
    </section>
  )
}

/**
 * An opening panel: a hairline `Box` named for assistive tech, printing no
 * title (the contents say what they are). `.su-sheet-section` is the print
 * class for the page-break rule.
 */
function SheetPanel({
  title,
  className,
  stackClassName,
  children,
}: {
  title: string
  className?: string
  stackClassName?: string
  children: ReactNode
}) {
  return (
    <Box
      as="section"
      label={title}
      frame="hairline"
      className={cn('su-sheet-section', className)}
      bodyStyle={PANEL_BODY}
    >
      <div className={cn('su-sheet-section-stack', stackClassName)}>{children}</div>
    </Box>
  )
}
