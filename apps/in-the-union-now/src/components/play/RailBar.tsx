/**
 * RailBar — the cockpit's top rail: return-to-workspace, the active entity
 * stamp, and (later) settings / rules-source affordances. Bordered (a "forward"
 * surface). Phase 1 wires Return to Workspace; Settings is a placeholder.
 */

import { AppLink } from '../shared/AppLink'

export function RailBar({ title }: { title: string }) {
  return (
    <div className="pc-rail">
      <AppLink href="/" className="pc-railbtn">
        ◄ Return to Workspace
      </AppLink>
      <span className="pc-stamp pc-stamp-mech">{title}</span>
      <span className="flex-1" />
      <button type="button" className="pc-railbtn" title="Rules & sources — planned" disabled>
        ⚙ Settings
      </button>
    </div>
  )
}
