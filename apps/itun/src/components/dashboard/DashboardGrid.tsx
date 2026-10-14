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
 * The display is always the document surface, so there is no light/dark flag.
 * `.su-dash-display-light` exists as a class because the Mediator Dashboard
 * mounts display content outside the grid and needs the same treatment on its own.
 */
export function DashboardGrid({ mount, rail, primary, display }: DashboardGridProps) {
  return (
    <div className="su-dash-grid" data-mount={mount}>
      <div className="su-dash-rail">{rail}</div>
      <div className="su-dash-primary">{primary}</div>
      <div className="su-dash-display su-dash-display-light">{display}</div>
    </div>
  )
}
