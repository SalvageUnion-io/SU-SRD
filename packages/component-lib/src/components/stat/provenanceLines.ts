import type { StatBreakdown } from 'salvageunion-reference/rules'

import type { ProvenanceLine } from './StatProvenance'

export type ProvenanceLabels = {
  /** Names the rules baseline, e.g. 'Atlas chassis', 'Tech 4 base', 'Pilot base'. */
  base: string
  /**
   * Names the rules-sourced contribution, e.g. 'Installed systems',
   * 'Battle type bonus', 'Injuries'. Only rendered when non-zero.
   */
  installed?: string
  /** Optional qualifier on the base line, e.g. 'base', 'chassis'. */
  baseDetail?: string
  /** Optional qualifier on the contribution line, e.g. 'statBonus'. */
  installedDetail?: string
}

/**
 * Turn a numeric `StatBreakdown` into the labelled ledger `StatProvenance`
 * renders (ADR-029).
 *
 * The contribution line is currently a single **aggregate** — the derivation
 * sums `statBonus` across installed items and returns one number, so there is no
 * honest way to attribute it per item yet. Per-source attribution ("Heat Sink
 * ×2", "Beefcake") arrives with the contribution model, which is what makes each
 * addend nameable; this helper is shaped to take those lines unchanged when it
 * does. Showing one truthful aggregate now beats inventing a breakdown the data
 * cannot support.
 *
 * Zero-valued lines are omitted — a ledger listing "+0" for everything a mech
 * does not have is noise, not provenance.
 */
export function linesFromBreakdown(
  parts: StatBreakdown,
  labels: ProvenanceLabels
): ProvenanceLine[] {
  const lines: ProvenanceLine[] = [
    {
      kind: 'base',
      label: labels.base,
      ...(labels.baseDetail ? { detail: labels.baseDetail } : {}),
      amount: parts.base,
    },
  ]

  if (parts.installed !== 0) {
    lines.push({
      kind: 'contribution',
      label: labels.installed ?? 'Installed items',
      ...(labels.installedDetail ? { detail: labels.installedDetail } : {}),
      amount: parts.installed,
    })
  }

  if (parts.adjustment !== 0) {
    lines.push({
      kind: 'adjustment',
      label: 'Manual adjustment',
      detail: 'entered by hand',
      amount: parts.adjustment,
    })
  }

  // An override appends to the full derivation rather than replacing it, so the
  // revert target stays visible and explained (ADR-022 amendment).
  if (parts.overridden) {
    lines.push({ kind: 'derived', label: 'Derived', amount: parts.derived })
    lines.push({
      kind: 'override',
      label: 'Override',
      detail: 'pinned by hand',
      amount: parts.override ?? parts.total,
    })
  }

  return lines
}
