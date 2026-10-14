/**
 * SheetSectionCard — the poster `.dcard` section container (the poster redesign).
 *
 * Composes the shared `Card` (never a hand-rolled div) into the poster's
 * accent-framed section card:
 *   - 3px `var(--tone)` border (the sheet accent), radius 3;
 *   - an accent HEADER band in the `chead` shape — the black-stamp title +
 *     optional count `.tag`;
 *   - a paper BODY block (no left rail, ruleset §3.10), floating on
 *     `var(--tone)` side strips (poster `.dcard-body` `margin:0 12px`);
 *   - an optional accent FOOTER band with a source line + trailing chips.
 *
 * Entity cards nest inside the body UNTOUCHED (KEEP rule 1) — this only frames
 * the region; the `Ecflow` entity-card grid is passed as `children`.
 *
 * Themes per sheet automatically via the `--tone` / `--tone-deep` CSS vars
 * (same route as `EDIT_CUE_HOVER_CLASS` / `VitalGauge`), never per-section color
 * classes. Keeps the `.sheet-section` print class for the page-break rule.
 */

import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { Badge } from '../atoms/Badge'
import { Card } from './Card'

type SheetSectionCardProps = {
  /** Section title — rendered as the black stamp in the header's left group. */
  title: string
  /**
   * Optional count/meta tag after the title (poster `.tag`). Typically a
   * `<Stat orientation="horizontal" size="compact" label=… value=… />` LABEL·VALUE chip.
   */
  count?: ReactNode
  /** Footer source line (poster `.dcard-foot .src`), e.g. 'Salvage Union · Pilot Abilities'. */
  source?: ReactNode
  /** Extra classes on the card wrapper (e.g. a grid-span). */
  className?: string
  /** Extra classes on the paper body block (e.g. the `Ecflow` grid gaps). */
  bodyClassName?: string
  /**
   * `frame` (default) is the accent-framed card with its header band (a
   * wizard's rule brief). `paper` is a live sheet's opening panel, in Read and
   * Edit alike (board 10): a flat paper panel under a one-unit-colour top
   * rule. It prints no title: the section is named for assistive tech, and
   * the contents say what they are.
   */
  surface?: 'frame' | 'paper'
  children: ReactNode
}

/** The read state's panel: paper, a hairline, and a unit-colour rule on top. */
const PAPER_PANEL = {
  backgroundColor: color.paper,
  borderColor: color.ink40,
  borderStyle: 'solid',
  borderTopColor: 'var(--tone)',
  borderTopWidth: borderWidth.entity,
  borderWidth: borderWidth.hairline,
  display: 'flex',
  flexDirection: 'column',
  padding: `${space[16]} ${space[20]}`,
} satisfies CSSProperties

const PAPER_COUNT = {
  marginBottom: space[12],
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: space[8],
} satisfies CSSProperties

const HEAD_LEFT = {
  display: 'flex',
  minWidth: 0,
  alignItems: 'center',
  gap: space[8],
} satisfies CSSProperties

const SOURCE = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.semibold,
  textTransform: 'uppercase',
  lineHeight: 1,
  letterSpacing: tracking.caps,
} satisfies CSSProperties

/** The tone side strips around the paper block. */
const STRIPS = {
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  backgroundColor: 'var(--tone)',
  padding: `0 ${space[12]} ${space[12]}`,
} satisfies CSSProperties

/** Card-composed poster section container. */
export function SheetSectionCard({
  title,
  count,
  source,
  className,
  bodyClassName,
  surface = 'frame',
  children,
}: SheetSectionCardProps) {
  if (surface === 'paper') {
    return (
      <section aria-label={title} className={cn('sheet-section', className)} style={PAPER_PANEL}>
        {count && <div style={PAPER_COUNT}>{count}</div>}
        <div className={cn('su-sheet-section-stack', bodyClassName)}>{children}</div>
      </section>
    )
  }
  return (
    <Card
      // Accent band on header + footer. The colour goes in as `headerBgColor`,
      // never as a `headerBg` class: Card derives the DEEP accent for its
      // sub-header and footer bands from the header, and from a class that is a
      // string rewrite (`bg-mech` → `var(--color-mech)`) that an arbitrary value
      // such as `bg-[var(--tone)]` turns into a variable that does not exist —
      // the footer band then painted no colour at all.
      headerBgColor="var(--tone)"
      borderColor="var(--tone)"
      // `.sheet-section` keeps the print page-break rule; cardStyle.className
      // REPLACES the default shadow, so sections read flat like the poster.
      cardStyle={{ className: cn('sheet-section', className) }}
      headerContent={
        <div style={HEAD_LEFT}>
          <Badge shape="stamp" size="full">
            {title}
          </Badge>
          {count}
        </div>
      }
      footerContent={
        source ? (
          // No colour of its own — it inherits the footer band's paper text:
          // dark text on the band's deep accent would be unreadable.
          <span style={SOURCE}>{source}</span>
        ) : undefined
      }
    >
      {/* Accent side strips (`.dcard-body` margin) wrap the paper block. */}
      {/* The 12px foot matches the 12px side strips. Without it the card showed 12px
          of tone down each side but nothing along the bottom, so the foot was
          just the frame border and read thin against those sides — the card
          looked unterminated. A footer band supplies this weight when there is
          one; this is the same weight for the sections that have none. */}
      <div style={STRIPS}>
        <div className={cn('su-sheet-section-paper', bodyClassName)}>{children}</div>
      </div>
    </Card>
  )
}
