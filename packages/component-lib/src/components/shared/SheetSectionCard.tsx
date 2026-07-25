/**
 * SheetSectionCard — the poster `.dcard` section container (redesign D5).
 *
 * Composes the shared `Card` (never a hand-rolled div) into the poster's
 * accent-framed section card:
 *   - 3px `var(--tone)` border (the sheet accent), radius 3;
 *   - an accent HEADER band in the `chead` shape — a left group (black-stamp
 *     title + optional count `.tag`) and a right group pinned `ml-auto` for the
 *     section controls (the Phase 1 `HButton` / `SectionChead` vocabulary, lifted
 *     verbatim into this header);
 *   - a paper BODY block with a 3px `var(--tone-deep)` LEFT rule, floating on
 *     `var(--tone)` side strips (poster `.dcard-body` `margin:0 12px`);
 *   - an optional accent FOOTER band with a source line + trailing chips.
 *
 * Entity cards nest inside the body UNTOUCHED (KEEP rule 1) — this only frames
 * the region; the `Ecflow` entity-card grid is passed as `children`.
 *
 * Themes per sheet automatically via the `--tone` / `--tone-deep` CSS vars
 * (same route as `EDIT_CUE_CLASS` / `VitalGauge`), never per-section color
 * classes. Keeps the `.sheet-section` print class for the page-break rule.
 */

import type { ReactNode } from 'react'
import { Badge } from '../chrome/Badge'
import { Card } from './Card'
import { cn } from '../../utils/cn'

type SheetSectionCardProps = {
  /** Section title — rendered as the black stamp in the header's left group. */
  title: string
  /**
   * Optional count/meta tag after the title (poster `.tag`). Typically a
   * `<Stat orientation="horizontal" size="compact" label=… value=… />` LABEL·VALUE chip.
   */
  count?: ReactNode
  /** Header-right controls (the section's `HButton` — Edit/Done or + Add). */
  controls?: ReactNode
  /** Footer source line (poster `.dcard-foot .src`), e.g. 'Salvage Union · Pilot Abilities'. */
  source?: ReactNode
  /** Extra classes on the card wrapper (e.g. a grid-span). */
  className?: string
  /** Extra classes on the paper body block (e.g. the `Ecflow` grid gaps). */
  bodyClassName?: string
  children: ReactNode
}

/** Card-composed poster section container. */
export function SheetSectionCard({
  title,
  count,
  controls,
  source,
  className,
  bodyClassName,
  children,
}: SheetSectionCardProps) {
  return (
    <Card
      // Accent band on header + footer.
      //
      // `headerBgColor` is load-bearing, not redundant with `headerBg`. Card
      // derives the DEEP accent for its sub-header and footer bands from the
      // header, and its derivation is a string rewrite of the utility class:
      // `bg-mech` → `var(--color-mech)`. Handed the arbitrary-value class
      // `bg-[var(--tone)]` that rewrite produces `var(--color-[var(--tone)])`,
      // which is not a variable that exists, so the `color-mix` around it was
      // invalid and the whole declaration was dropped — the footer band painted
      // no colour at all and the section's citation line sat on bare paper.
      // Passing the colour directly gives the derivation something real to work
      // from; `headerBg` stays for the header's own fill.
      headerBg="bg-[var(--tone)]"
      headerBgColor="var(--tone)"
      borderColor="var(--tone)"
      // `.sheet-section` keeps the print page-break rule; cardStyle.className
      // REPLACES the default shadow, so sections read flat like the poster.
      cardStyle={{ className: cn('sheet-section', className) }}
      bodyPadding="p-0"
      headerContent={
        <>
          <div className="flex min-w-0 items-center gap-2">
            <Badge shape="stamp" size="full">
              {title}
            </Badge>
            {count}
          </div>
          {controls && <div className="ml-auto flex items-center gap-2">{controls}</div>}
        </>
      }
      footerContent={
        source ? (
          // No colour of its own — it inherits the footer band's `text-paper`.
          // It used to force `text-ink/85`, which only read because the band
          // behind it was painting nothing; on the deep accent that band is
          // supposed to have, dark-on-dark would have been unreadable.
          <span className="min-w-0 truncate font-cond text-label font-semibold uppercase leading-none tracking-caps">
            {source}
          </span>
        ) : undefined
      }
    >
      {/* Accent side strips (`.dcard-body` margin) wrap the paper block; the
          paper block carries the deep-tone LEFT rule. */}
      {/* `pb-3` matches the `px-3` side strips. Without it the card showed 12px
          of tone down each side but nothing along the bottom, so the foot was
          just the frame border and read thin against those sides — the card
          looked unterminated. A footer band supplies this weight when there is
          one; this is the same weight for the sections that have none. */}
      <div className="flex flex-1 flex-col bg-[var(--tone)] px-3 pb-3">
        <div
          className={cn(
            'flex-1 border-l-entity border-[var(--tone-deep)] bg-paper px-3.5 py-3',
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </Card>
  )
}
