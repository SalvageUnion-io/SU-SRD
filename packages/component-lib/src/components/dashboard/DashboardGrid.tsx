import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import './DashboardGrid.css'

type DashboardGridProps = {
  /**
   * Ontology of the active mount (e.g. `'mech'` | `'pilot'` | `'downtime'`),
   * set as `data-mount` so the rail border takes the matching tint. Omit for
   * the neutral (untinted) rail.
   */
  mount?: string
  /** Top rail content (return-to-workspace, the entity stamp, settings). */
  rail: ReactNode
  /** Primary row — the Active Item band. */
  primary: ReactNode
  /** The display surface (SRD reference view / downtime). */
  display: ReactNode
  /**
   * Light "paper" display surface — the one forward-reading, light-themed inset
   * (the SRD reference view). Omit for the dark placeholder display.
   */
  displayLight?: boolean
  /** The wheel column — the rotary Dial. */
  wheel: ReactNode
}

/**
 * DashboardGrid — the Dashboard's fixed four-region scaffold (rail / primary /
 * wheel / display) laid inside {@link DashboardCanvas}. A pure slotted layout:
 * it owns the region wrappers + `data-mount` rail tint; callers pass the
 * store-wired instruments as slots. Legacy-tier (bespoke dark-world CSS).
 */
export function DashboardGrid({
  mount,
  rail,
  primary,
  display,
  displayLight = false,
  wheel,
}: DashboardGridProps) {
  return (
    <div className="pc-grid" data-mount={mount}>
      <div className="pc-rail">{rail}</div>
      <div className="pc-primary">{primary}</div>
      <div className={cn('pc-display', displayLight && 'pc-display-light')}>{display}</div>
      <div className="pc-wheel">{wheel}</div>
    </div>
  )
}
