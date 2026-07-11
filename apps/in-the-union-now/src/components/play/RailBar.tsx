/**
 * RailBar — the cockpit's top rail: return-to-workspace, the active entity
 * stamp, and (later) settings / rules-source affordances. Bordered (a "forward"
 * surface). Phase 1 wires Return to Workspace; Settings is a placeholder.
 */

import type { CSSProperties } from 'react'

import { AppLink } from '../shared/AppLink'

type RailFam = 'mech' | 'pilot' | 'crawler'

const STAMP_BG: Record<RailFam, string> = {
  mech: 'var(--pc-mech-deep)',
  pilot: 'var(--pc-pilot-deep)',
  crawler: 'var(--pc-crawler-deep)',
}

export function RailBar({ title, fam = 'mech' }: { title: string; fam?: RailFam }) {
  return (
    <div className="pc-rail">
      <AppLink href="/" className="pc-railbtn">
        ◄ Return to Workspace
      </AppLink>
      <span className="pc-stamp" style={{ background: STAMP_BG[fam] } as CSSProperties}>
        {title}
      </span>
      <span className="flex-1" />
      <button type="button" className="pc-railbtn" title="Rules & sources — planned" disabled>
        ⚙ Settings
      </button>
    </div>
  )
}
