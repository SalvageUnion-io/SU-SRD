import type { ReactNode } from 'react'
import { Fragment } from 'react'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { EntityTooltip } from '../EntityTooltip'

/** One sub-header cell — a horizontal Stat `[label | value]` (value
 * optional for label-only keywords, e.g. "Immobile"). The MODIFIED-STATS language
 * uses `borderColor` (an upgraded stat's cell border) and `labelBg` (an added /
 * modified trait's label fill). */
export type EntityCardSubHeaderCell = {
  key: string
  label: string
  value?: string | number
  /** Raw CSS colour for the whole cell's border — marks an upgraded stat. */
  borderColor?: string
  /** Raw CSS colour for the label fill — marks an added/modified trait. */
  labelBg?: string
  /**
   * The rules entity this cell NAMES — a trait ("Explosive"), a keyword. When
   * set, the segment summons that entity's hovercard on hover, the same as an
   * in-prose `[[trait]]` reference does. Unresolvable refs render as plain text,
   * so a cell never loses its reading to a missing entity.
   */
  entityRef?: { schemaName: SURefEnumSchemaName; name: string }
}

type EntityCardSubHeaderProps = {
  /** Darker shade of the domain/tech-level/rust tone (a raw CSS colour). */
  bgColor: string
  /** Sub-header cells — entity traits, or an action's range/damage/traits. */
  cells: EntityCardSubHeaderCell[]
  /** Leading node rendered FIRST in the row — e.g. an action's EP/AP
   * `ActivationCost`, which must lead before Range/Damage/Traits. */
  leading?: ReactNode
  compact?: boolean
  /**
   * This card is NESTED inside another (`depth > 0`) — an action or ability
   * hanging off its entity, rather than the entity the page is about.
   *
   * Deliberately not `compact`, which is the SIZE flag (`depth > 0 || size !==
   * 'large'`) and so is also true of a small top-level card. The two answer
   * different questions: `compact` asks how much room there is, this asks
   * whose stats these are.
   */
  nested?: boolean
  /** Foreground for this band: the deep band's own text colour, chosen by WCAG
   * contrast against `darkTone` (`resolveCardColors().onDarkText`). It is NOT the
   * header title's value. The sub-header sits on a darker shade, so it can need
   * paper while the title needs ink (TL1: ink header, paper sub-header; see
   * cardSeams.test.ts). Defaults to paper, the solid-tone case. */
  onBandText?: string
}

/**
 * EntityCardSubHeader — the unified card's SUB-HEADER band, a darker shade of the tone.
 *
 * A feature of the card BASE: every card — entity, action, or NPC, full or
 * nested — renders this same band. Its content is horizontal Stat cells
 * (entity TRAITS, or an action's range/damage/traits, plus read-only choices)
 * and an optional `leading` node (an action's EP box).
 */
export function EntityCardSubHeader({
  bgColor,
  cells,
  leading,
  compact = false,
  nested = false,
  onBandText = 'text-paper',
}: EntityCardSubHeaderProps) {
  if (!leading && cells.length === 0) return null

  // Cell size ladder, nudged up one notch: a FULL card's cells are the default
  // (text-sm); a compact/nested card's cells are one step down (`compact` →
  // text-xs) — bigger than text-badge, still smaller than full. The
  // inter-cell gap is the SAME (gap-1.5) at both sizes.

  // Book-style sub-header: the stat cells read as ONE line of basic cream
  // (paper-tone) text, separated by " // ", matching the rulebook's trait line
  // rather than a row of stamps. Each cell's `label value` pairing is punctuated
  // by kind:
  //   - a MEASURED cell reads "Range: Close" / "Damage: 4 SP" (colon after the
  //     label). Damage joins Range here because it is the same shape of
  //     statement — a named quantity — and read "Damage 4SP" without one;
  //   - a TRAIT always parenthesises its value — "Explosive (1)", "Burn (2)",
  //     "Uses (3)", "Uses (Destroy)". The book prints every qualified trait this
  //     way, including the non-numeric ones (its own glossary entry reads
  //     "Uses (X)"), so the parens follow the CELL KIND, not the value's type.
  //     Keying off "is it a number" left a trait like Uses/Destroy reading
  //     "USES DESTROY", the one shape the rulebook never uses;
  //   - any other numeric value still reads "Label (4)";
  //   - everything else (a label-only keyword) is unchanged.
  const COLON_CELLS = new Set(['range', 'damage'])
  const cellToText = (cell: EntityCardSubHeaderCell) => {
    if (cell.value == null || cell.value === '') return cell.label
    if (COLON_CELLS.has(cell.key) || cell.label === 'Range' || cell.label === 'Damage') {
      return `${cell.label}: ${cell.value}`
    }
    const isTrait = cell.key.startsWith('trait-')
    const isNumeric = typeof cell.value === 'number' || /^\d+$/.test(String(cell.value))
    if (isTrait || isNumeric) return `${cell.label} (${cell.value})`
    return `${cell.label} ${cell.value}`
  }
  // Each cell is still ONE segment of the book's trait line, but a segment that
  // NAMES a rules entity keeps that entity's hovercard, as an in-prose
  // `[[trait]]` reference does. Flattening the row to a single string would
  // make a card's own traits the one place the glossary is unreachable.
  const parts = cells.map((cell) => {
    const text = cellToText(cell)
    if (!cell.entityRef) return { key: cell.key, node: text as ReactNode }
    return {
      key: cell.key,
      node: (
        <EntityTooltip
          schemaName={cell.entityRef.schemaName}
          entityName={cell.entityRef.name}
          openDelay={300}
        >
          <span className="cursor-help">{text}</span>
        </EntityTooltip>
      ) as ReactNode,
    }
  })

  return (
    <div
      className={cn(
        // px-3 (both sizes) so sub-header content shares the seam/title left edge.
        'flex w-full flex-wrap items-center gap-1.5',
        compact ? 'px-3 py-1' : 'px-3 py-1.5'
      )}
      style={{ backgroundColor: bgColor }}
    >
      {leading}
      {parts.length > 0 && (
        <span
          className={cn(
            'font-cond uppercase leading-snug tracking-caps-tight',
            // Weight says WHOSE stats these are. The entity the card is about
            // states its own in BOLD; a nested action or ability hanging off it
            // states its in ITALIC, as an aside. Two cards stacked on a page
            // then read as statement and annotation rather than as peers.
            nested ? 'italic' : 'font-bold',
            onBandText,
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {parts.map((part, i) => (
            <Fragment key={part.key}>
              {i > 0 && ' // '}
              {part.node}
            </Fragment>
          ))}
        </span>
      )}
    </div>
  )
}
