import type { ReactNode } from 'react'
import type { Size } from '../../../styles/sizing'
import { Badge } from '../../atoms/Badge'
import { Stat } from '../../atoms/Stat'
import type { AxisMarker } from './entityCardTone'
import { LEGAL_STARTING_PATTERN, LEGAL_STARTING_PATTERN_NOTE } from './legalStartingPattern'
import { UserMadeStamp } from './UserMadeStamp'

/** An entity's head labels (`CardLabels`, `labelChips`). */
export type LabelsProps = {
  /** A parent-provided seal (GRANTS, CHASSIS ABILITY). */
  seal: { label: string; tone: string } | undefined
  /** A caller's note that says more than the kind ("From Veteran", "Crawler crew · Med Bay"). */
  note?: string
  axisMarkers: AxisMarker[]
  legalStartingPattern: boolean
  /** USER-MADE (ruleset §3.9): a dashed User-made stamp after the others. */
  userMade?: boolean
}

/**
 * The same labels as chips of a head's one strip (`Chips`' marks, C2): beside
 * chips they are chips, at the strip's Size, never a cluster of their own at
 * another (siblings on one line share one Size, ruleset §4.7; owner's rule,
 * 2026-10-14, as a Row's note). The seal keeps its stamp and tone, and
 * User-made its dashed stamp; every other label is a `Stat` cell, the Legal
 * Starting Pattern a label-only one that says the book's words on hover.
 */
export function labelChips(
  { seal, note, axisMarkers, legalStartingPattern, userMade = false }: LabelsProps,
  size: Size
): ReactNode[] {
  return [
    seal && (
      <Badge
        key="seal"
        shape="stamp"
        size={size}
        style={seal.tone === 'var(--color-ink)' ? undefined : { backgroundColor: seal.tone }}
      >
        {seal.label}
      </Badge>
    ),
    note && <Stat key="note" label={note} size={size} />,
    ...axisMarkers.map((marker) => (
      <Stat key={`axis:${marker.label}`} label={marker.label} value={marker.value} size={size} />
    )),
    legalStartingPattern && (
      <Stat
        key="legal-starting"
        label={LEGAL_STARTING_PATTERN}
        hoverText={LEGAL_STARTING_PATTERN_NOTE}
        size={size}
      />
    ),
    userMade && <UserMadeStamp key="user-made" size={size} />,
  ].filter(Boolean)
}
