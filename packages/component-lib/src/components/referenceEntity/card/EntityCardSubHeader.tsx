import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'

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
  /** Foreground for this band — the SAME value the card gives its header title
   * (`onBandText`). The sub-header rides a darker shade of the same tone, so it
   * flips to ink exactly when the title does (damaged/destroyed greys, ghosted
   * action/NPC bands); hardcoding paper left it unreadable on those light
   * bands. Defaults to paper, the solid-tone case. */
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
  onBandText = 'text-paper',
}: EntityCardSubHeaderProps) {
  if (!leading && cells.length === 0) return null

  // Cell size ladder, nudged up one notch: a FULL card's cells are the default
  // (text-sm); a compact/nested card's cells are one step down (`compact` →
  // text-xs) — bigger than the old text-label, still smaller than full. The
  // inter-cell gap is the SAME (gap-1.5) at both sizes.

  // Book-style sub-header: the stat cells read as ONE line of basic cream
  // (paper-tone) text, separated by " // ", matching the rulebook's trait line
  // rather than a row of stamps. Each cell's `label value` pairing is punctuated
  // by kind:
  //   - a MEASURED cell reads "Range: Close" / "Damage: 4 SP" (colon after the
  //     label). Damage joins Range here because it is the same shape of
  //     statement — a named quantity — and read "Damage 4SP" without one;
  //   - a NUMERIC value reads "Heat (4)" / "Blast (3)" (value in parens);
  //   - everything else (a label-only keyword) is unchanged.
  const COLON_CELLS = new Set(['range', 'damage'])
  const cellToText = (cell: EntityCardSubHeaderCell) => {
    if (cell.value == null || cell.value === '') return cell.label
    if (COLON_CELLS.has(cell.key) || cell.label === 'Range' || cell.label === 'Damage') {
      return `${cell.label}: ${cell.value}`
    }
    const isNumeric = typeof cell.value === 'number' || /^\d+$/.test(String(cell.value))
    if (isNumeric) return `${cell.label} (${cell.value})`
    return `${cell.label} ${cell.value}`
  }
  const parts = cells.map(cellToText)

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
            // Italic: the stat line is an aside about the entity, not part of
            // its name, and the slant separates it from the upright title band
            // directly above at a glance.
            'font-cond italic uppercase leading-snug tracking-caps-tight',
            onBandText,
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {parts.join(' // ')}
        </span>
      )}
    </div>
  )
}
