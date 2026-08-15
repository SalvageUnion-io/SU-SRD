/**
 * Shared Ladle stage for dashboard instrument stories. Loads the `.pc-root`
 * token scope (DashboardCanvas.css) + the instrument stylesheet (instruments.css)
 * and frames children on the warm-paper cockpit ground — so a single instrument
 * renders exactly as it does inside the live Dashboard, without the full
 * scale-to-fit canvas.
 *
 * `pc-root` STAYS a class, and is not a Tailwind holdover: it is the instrument
 * token scope those three stylesheets key off, so the stage must keep applying
 * it. Only the frame's own `var(--color-*)` reads move onto `design/tokens.ts`
 * here (#799) — the ones inside `.pc-root` belong to the dashboard's own
 * stylesheets and migrate with the Compositions layer.
 */

import type { ReactNode } from 'react'
import { color, radius, space } from '../design/tokens'
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
        background: color.paper,
        padding: space[16],
        borderRadius: radius.panel,
        maxWidth: width,
      }}
    >
      {children}
    </div>
  )
}
