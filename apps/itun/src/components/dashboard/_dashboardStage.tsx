/**
 * Shared story stage for dashboard instrument stories. Loads the dashboard
 * stylesheet bundle (`styles/dashboard.css`: the `.su-dash-root` token scope, the
 * instruments and the grid — the components import none of it) and frames children on the warm-paper cockpit ground — so a single instrument
 * renders exactly as it does inside the live Dashboard, without the full
 * scale-to-fit canvas.
 *
 * `su-dash-root` STAYS a class, and is not a holdover: it is the instrument
 * token scope those three stylesheets key off, so the stage must keep applying
 * it. Only the frame's own `var(--color-*)` reads move onto `design/tokens.ts`
 * here (#799) — the ones inside `.su-dash-root` belong to the dashboard's own
 * stylesheets and migrate with the Compositions layer.
 */

import { color, radius, space } from 'component-lib/design/tokens'
import type { ReactNode } from 'react'
import '../../styles/dashboard.css'

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
      className="su-dash-root"
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
