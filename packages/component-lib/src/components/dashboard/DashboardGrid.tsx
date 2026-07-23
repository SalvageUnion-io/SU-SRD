import type { ReactNode } from 'react'
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
  /** The wheel column — the rotary Dial. */
  wheel: ReactNode
}

/**
 * DashboardGrid — the Dashboard's fixed four-region scaffold (rail / primary /
 * wheel / display) laid inside {@link DashboardCanvas}. A pure slotted layout:
 * it owns the region wrappers + `data-mount` rail tint; callers pass the
 * store-wired instruments as slots. The dashboard's own layout CSS lives beside
 * it in DashboardGrid.css.
 *
 * There used to be a `displayLight` boolean here, meaning "this display holds a
 * light SRD document rather than the dark placeholder". Both grounds are now
 * defined — the display is always the document surface — so the flag had only
 * one reachable value and has been removed rather than left as a switch nobody
 * may flip. `.pc-display-light` survives as a class because the Ladle stages
 * mount display content outside the grid and need the same treatment on its own.
 */
export function DashboardGrid({ mount, rail, primary, display, wheel }: DashboardGridProps) {
  return (
    <div className="pc-grid" data-mount={mount}>
      <div className="pc-rail">{rail}</div>
      <div className="pc-primary">{primary}</div>
      <div className="pc-display pc-display-light">{display}</div>
      <div className="pc-wheel">{wheel}</div>
    </div>
  )
}
