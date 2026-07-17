import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import { Stat } from '../../shared/Stat'

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

/** A cohesive labelled stat group in the sub-header (e.g. "Bonus per Tech
 * Level" + its "+N" cells) — a label cell followed by "+N" cells, all the SAME
 * horizontal Stat treatment as the trait cells (black border, same
 * size/padding), wrapped in ONE container so the block line-breaks together. */
export type EntityCardSubHeaderGroup = {
  label: string
  cells: EntityCardSubHeaderCell[]
}

type EntityCardSubHeaderProps = {
  /** Darker shade of the domain/tech-level/rust tone (a raw CSS colour). */
  bgColor: string
  /** Sub-header cells — entity traits, or an action's range/damage/traits. */
  cells: EntityCardSubHeaderCell[]
  /** Leading node rendered FIRST in the row — e.g. an action's EP/AP
   * `ActivationCostBox`, which must lead before Range/Damage/Traits. */
  leading?: ReactNode
  /** Optional cohesive labelled stat group (e.g. bonus-per-tech-level), rendered
   * as one wrap-together block after the cells. */
  group?: EntityCardSubHeaderGroup
  /** Right-aligned trailing node (e.g. the status chip), laid out space-between
   * against the trait cells. Absent ⇒ the band renders its plain packed layout. */
  trailing?: ReactNode
  compact?: boolean
}

/**
 * EntityCardSubHeader — the unified card's SUB-HEADER band, a darker shade of the tone.
 *
 * A feature of the card BASE: every card — entity, action, or NPC, full or
 * nested — renders this same band. Its content is horizontal Stat cells
 * (entity TRAITS, or an action's range/damage/traits, plus read-only choices),
 * an optional `leading` node (an action's EP box), and an optional cohesive
 * `group` (a green-tinted label + "+N" cells that wrap together — same cell
 * treatment as the traits, e.g. bonus-per-tech-level).
 */
export function EntityCardSubHeader({
  bgColor,
  cells,
  leading,
  group,
  trailing,
  compact = false,
}: EntityCardSubHeaderProps) {
  const hasGroup = !!group && group.cells.length > 0
  if (!leading && cells.length === 0 && !hasGroup && !trailing) return null

  // Cell size ladder, nudged up one notch: a FULL card's cells are the default
  // (text-sm); a compact/nested card's cells are one step down (`compact` →
  // text-xs) — bigger than the old text-label, still smaller than full. The
  // inter-cell gap is the SAME (gap-1.5) at both sizes.

  const inner = (
    <>
      {leading}
      {cells.map((cell) => (
        <Stat
          key={cell.key}
          orientation="horizontal"
          label={cell.label}
          value={cell.value}
          state={cell.borderColor ? 'modified' : undefined}
          bgColor={cell.labelBg}
          textColor={cell.labelBg ? 'var(--color-paper)' : undefined}
          compact={compact}
        />
      ))}
      {hasGroup && (
        // One container → the label + all its cells wrap together as a unit, the
        // EXACT same horizontal Stat treatment as the trait cells. Only
        // the LABEL box is tinted GREEN (`status-ok`); the stat cells are BLACK.
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Stat
            orientation="horizontal"
            label={group.label}
            bgColor="var(--color-status-ok)"
            textColor="var(--color-paper)"
            compact={compact}
          />
          {group.cells.map((cell) => (
            <Stat
              key={cell.key}
              orientation="horizontal"
              label={cell.label}
              value={cell.value}
              compact={compact}
            />
          ))}
        </span>
      )}
    </>
  )

  // No trailing node ⇒ the plain packed band (DOM-identical to read-only today).
  if (!trailing) {
    return (
      <div
        className={cn(
          // px-3 (both sizes) so sub-header content shares the seam/title left edge.
          'flex w-full flex-wrap items-center gap-1.5',
          compact ? 'px-3 py-1' : 'px-3 py-1.5'
        )}
        style={{ backgroundColor: bgColor }}
      >
        {inner}
      </div>
    )
  }

  // With a trailing node (e.g. the status chip): traits left, trailing right,
  // space-between across the band.
  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center justify-between gap-1.5',
        compact ? 'px-3 py-1' : 'px-3 py-1.5'
      )}
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{inner}</div>
      <div className="shrink-0">{trailing}</div>
    </div>
  )
}
