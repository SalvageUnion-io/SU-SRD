/**
 * Legacy "before" capture — ITUN Dashboard `RailBar` (the top rail).
 *
 * Reproduces the rail from
 * apps/in-the-union-now/src/components/dashboard/RailBar.tsx VERBATIM — the
 * `.pc-rail` bar with its Return-to-Workspace link, the active-entity stamp
 * (mount-tinted background), a flex spacer, and the trailing Settings / Leave
 * Downtime `.pc-railbtn`. ITUN's app-only `AppLink` is inlined here as a plain
 * `<a>`. The active-mount border tint (applied by the enclosing Dashboard grid)
 * is frozen by wrapping in a bare `pc-grid[data-mount]`. L1 reconciliation:
 * freeze the "before", do not refactor the raw markup.
 */

import type { Story } from '@ladle/react'
import type { CSSProperties, ReactNode } from 'react'
import { Caption } from '../../_harness'
import './LegacyRailBar.css'

type RailFam = 'mech' | 'pilot' | 'crawler'
const STAMP_BG: Record<RailFam, string> = {
  mech: 'var(--pc-mech-deep)',
  pilot: 'var(--pc-pilot-deep)',
  crawler: 'var(--pc-crawler-deep)',
}

// Verbatim reproduction of RailBar.tsx (AppLink inlined as <a>).
function RailBar({
  title,
  fam = 'mech',
  onLeaveDowntime,
}: {
  title: string
  fam?: RailFam
  onLeaveDowntime?: () => void
}) {
  return (
    <div className="pc-rail" style={{ height: 40 }}>
      <a href="/" className="pc-railbtn">
        ◄ Return to Workspace
      </a>
      <span className="pc-stamp" style={{ background: STAMP_BG[fam] } as CSSProperties}>
        {title}
      </span>
      <span className="flex-1" />
      {onLeaveDowntime ? (
        <button
          type="button"
          className="pc-railbtn"
          title="Return to the previous mount"
          onClick={onLeaveDowntime}
        >
          ◄ Leave Downtime
        </button>
      ) : (
        <button type="button" className="pc-railbtn" title="Rules & sources — planned" disabled>
          ⚙ Settings
        </button>
      )}
    </div>
  )
}

/** Dark ground stage; the mount-tinted rail is nested in a bare pc-grid. */
function RailFrame({ mount, children }: { mount: string; children: ReactNode }) {
  return (
    <div
      className="pc-root"
      style={{ background: 'var(--pc-ground)', padding: 10, borderRadius: 5 }}
    >
      <div className="pc-grid" data-mount={mount}>
        {children}
      </div>
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Dashboard/Rail Bar' }

export const Default: Story = () => (
  <div style={{ maxWidth: 900 }}>
    <Caption>
      RailBar — the Dashboard's bordered top rail: Return to Workspace, the mech-tinted
      active-entity stamp, and the disabled Settings affordance.
    </Caption>
    <RailFrame mount="mech">
      <RailBar title="Mech · Iron Mongrel" fam="mech" />
    </RailFrame>
  </div>
)

export const AllMounts: Story = () => (
  <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Caption>
      RailBar across the three mount tints (mech / pilot / crawler) plus the Downtime variant whose
      trailing action becomes Leave Downtime.
    </Caption>
    <RailFrame mount="mech">
      <RailBar title="Mech · Iron Mongrel" fam="mech" />
    </RailFrame>
    <RailFrame mount="pilot">
      <RailBar title="Pilot · Vasquez" fam="pilot" />
    </RailFrame>
    <RailFrame mount="downtime">
      <RailBar title="Downtime · Rust Wagon" fam="crawler" onLeaveDowntime={() => undefined} />
    </RailFrame>
  </div>
)
