/**
 * RailBar — the Dashboard's top rail content: return-to-workspace, the active
 * entity stamp, and the settings / leave-downtime action. Presentational only —
 * the `.pc-rail` region wrapper (grid area + flex row + forward border) is
 * supplied by DashboardGrid's rail slot, and the app injects its own router link
 * via `returnControl` (component-lib stays routing-agnostic).
 */

import type { CSSProperties, ReactNode } from 'react'

export type RailFam = 'mech' | 'pilot' | 'crawler'

const STAMP_BG: Record<RailFam, string> = {
  mech: 'var(--color-sheet-mech-deep)',
  pilot: 'var(--color-sheet-pilot-deep)',
  crawler: 'var(--color-sheet-crawler-deep)',
}

export type RailBarProps = {
  title: string
  fam?: RailFam
  /** Return-to-workspace control — the app passes its router link (an AppLink). */
  returnControl?: ReactNode
  /** When set, the rail's right action becomes "Leave Downtime". */
  onLeaveDowntime?: () => void
}

export function RailBar({ title, fam = 'mech', returnControl, onLeaveDowntime }: RailBarProps) {
  return (
    <>
      {returnControl}
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
    </>
  )
}
