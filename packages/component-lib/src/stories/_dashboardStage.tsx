/**
 * Shared Ladle stage for dashboard instrument stories. Loads the `.pc-root`
 * token scope (DashboardCanvas.css) + the instrument stylesheet (instruments.css)
 * and frames children on the warm-paper cockpit ground — so a single instrument
 * renders exactly as it does inside the live Dashboard, without the full
 * scale-to-fit canvas.
 */

import type { ReactNode } from 'react'
import '../components/dashboard/DashboardCanvas.css'
import '../components/dashboard/DashboardGrid.css'
import '../components/dashboard/instruments.css'

export function InstrumentStage({
  children,
  width = 340,
  mount = 'mech',
}: {
  children: ReactNode
  width?: number
  mount?: 'mech' | 'pilot' | 'crawler'
}) {
  return (
    <div
      className="pc-root"
      data-mount={mount}
      style={{
        background: 'var(--color-paper)',
        padding: 16,
        borderRadius: 'var(--radius-panel)',
        maxWidth: width,
      }}
    >
      {children}
    </div>
  )
}
