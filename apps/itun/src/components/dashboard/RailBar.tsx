/**
 * RailBar — the Dashboard's top rail content: return-to-workspace, the active
 * entity stamp, whether play is being saved (`status`, the app's
 * `SavedIndicator`), and the right-hand action: the Mediator's Start or End
 * Downtime, or settings for a player. Presentational only —
 * the `.pc-rail` region wrapper (grid area + flex row + forward border) is
 * supplied by DashboardGrid's rail slot, and the app injects its own router link
 * via `returnControl` (component-lib stays routing-agnostic).
 */

import { Badge, Button } from 'component-lib'
import type { ReactNode } from 'react'

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
  /** Saved / offline, at the right before the action (the app's `SavedIndicator`). */
  status?: ReactNode
  /**
   * The Mediator's Downtime control (ADR-038 §5): Start while it is not running,
   * End while it is. When set it takes the place of the settings button.
   */
  downtimeAction?: { label: string; title: string; onClick: () => void }
}

export function RailBar({
  title,
  fam = 'mech',
  returnControl,
  status,
  downtimeAction,
}: RailBarProps) {
  return (
    <>
      {returnControl}
      <Badge
        shape="stamp"
        className="px-[9px] py-[5px] text-caption text-paper"
        style={{ backgroundColor: STAMP_BG[fam] }}
      >
        {title}
      </Badge>
      <span className="flex-1" />
      {status}
      {downtimeAction ? (
        <Button
          variant="ghost"
          size="compact"
          title={downtimeAction.title}
          onClick={() => downtimeAction.onClick()}
        >
          {downtimeAction.label}
        </Button>
      ) : (
        <Button variant="ghost" size="compact" title="Rules & sources — planned" disabled>
          ⚙ Settings
        </Button>
      )}
    </>
  )
}
