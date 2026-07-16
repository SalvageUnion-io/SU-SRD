import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import { StatDisplay } from '../../shared/StatDisplay'

/** One sub-header cell — a horizontal StatDisplay `[label | value]` (value
 * optional for label-only keywords, e.g. "Immobile"). */
export type NEWSubHeaderCell = {
  key: string
  label: string
  value?: string | number
}

type NEWSubHeaderProps = {
  /** Darker shade of the domain/tech-level/rust tone (a raw CSS colour). */
  bgColor: string
  /** Sub-header cells — entity traits, or an action's range/damage/traits. */
  cells: NEWSubHeaderCell[]
  /** Leading node rendered FIRST in the row — e.g. an action's EP/AP
   * `ActivationCostBox`, which must lead before Range/Damage/Traits. */
  leading?: ReactNode
  compact?: boolean
}

/**
 * NEWSubHeader — the unified card's SUB-HEADER band, a darker shade of the tone.
 *
 * A feature of the card BASE: every card — entity, action, or NPC, full or
 * nested — renders this same band. Its content is StatDisplays ONLY (each a
 * horizontal `[label | value]` cell): entity TRAITS, or an action's
 * range/damage/traits. No badges. Every stat axis lives in the header; source
 * lives only in the footer.
 */
export function NEWSubHeader({ bgColor, cells, leading, compact = false }: NEWSubHeaderProps) {
  if (!leading && cells.length === 0) return null

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center gap-1.5',
        compact ? 'px-2.5 py-1' : 'px-3.5 py-1.5'
      )}
      style={{ backgroundColor: bgColor }}
    >
      {leading}
      {cells.map((cell) => (
        // Cell size steps down with the card: a full card's cells are one
        // notch below the default (`compact` → text-xs); a compact/nested card's
        // cells drop another notch (`xs` → text-label).
        <StatDisplay
          key={cell.key}
          orientation="horizontal"
          label={cell.label}
          value={cell.value}
          xs={compact}
          compact={!compact}
        />
      ))}
    </div>
  )
}
