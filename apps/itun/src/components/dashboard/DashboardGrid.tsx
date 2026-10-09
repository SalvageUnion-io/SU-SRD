import type { ReactNode } from 'react'

type DashboardGridProps = {
  /**
   * Ontology of the active mount (e.g. `'mech'` | `'pilot'` | `'downtime'`),
   * set as `data-mount` so the rail border takes the matching tint. Omit for
   * the neutral (untinted) rail.
   */
  mount?: string
  /** Top rail content (return-to-workspace, the entity stamp, settings). */
  rail: ReactNode
  /** Primary row — the slot row: one Major and two Minors. */
  primary: ReactNode
  /** The display surface (the deck beside the display tabs, or Downtime). */
  display: ReactNode
}

/**
 * DashboardGrid — the Dashboard's fixed three-region scaffold (rail / primary /
 * display) laid inside {@link DashboardCanvas}. A pure slotted layout: it owns
 * the region wrappers + `data-mount` rail tint; callers pass the store-wired
 * instruments as slots. Its layout CSS lives in ITUN's
 * `src/styles/dashboard/DashboardGrid.css`.
 *
 * There used to be a `displayLight` boolean here, meaning "this display holds a
 * light SRD document rather than the dark placeholder". Both grounds are now
 * defined — the display is always the document surface — so the flag had only
 * one reachable value and has been removed rather than left as a switch nobody
 * may flip. `.pc-display-light` survives as a class because the story stages
 * mount display content outside the grid and need the same treatment on its own.
 */
export function DashboardGrid({ mount, rail, primary, display }: DashboardGridProps) {
  return (
    <div className="pc-grid" data-mount={mount}>
      <div className="pc-rail">{rail}</div>
      <div className="pc-primary">{primary}</div>
      <div className="pc-display pc-display-light">{display}</div>
    </div>
  )
}
