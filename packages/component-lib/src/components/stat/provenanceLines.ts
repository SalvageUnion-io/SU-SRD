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
 * Turn a `StatBreakdown` into the labelled ledger `StatProvenance`
 * renders (ADR-029).
 *
 * Two kinds of contribution, deliberately kept apart:
 *
 *   - `installed` is an **aggregate**: the derivation sums `statBonus` across
 *     installed items, so there is no honest per-item attribution yet. One
 *     truthful aggregate beats an invented breakdown.
 *   - `sources` are **named** — an ability, by name — and get a line each.
 *
 * Folding the second into the first is the bug this shape exists to prevent: it
 * renders "Beefcake +7" as installed hardware.
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

  // Named contributions get a line EACH. They must never be folded into the
  // aggregate above: doing so attributed an ability's bonus to installed
  // hardware, which is a provenance panel lying about provenance.
  for (const source of parts.sources ?? []) {
    lines.push({
      kind: 'contribution',
      label: source.source,
      ...(source.copies > 1 ? { detail: `×${source.copies}` } : {}),
      amount: source.amount,
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

/**
 * A one-line text rendering of the same ledger, for surfaces that can only take
 * a string.
 *
 * `Stat` cells carry an editable stepper cluster, so wrapping one in the
 * `StatProvenance` popover trigger would nest a button inside a button. Until
 * `Stat` grows its own non-nesting affordance, those surfaces render the
 * derivation through the existing `hoverText` tooltip instead — less rich than
 * the panel, but true, and it beats a number with no explanation at all.
 */
export function summarizeBreakdown(parts: StatBreakdown, labels: ProvenanceLabels): string {
  const terms: string[] = [`${labels.base} ${parts.base}`]
  if (parts.installed !== 0) {
    const sign = parts.installed < 0 ? '−' : '+'
    terms.push(`${sign}${Math.abs(parts.installed)} ${labels.installed ?? 'installed'}`)
  }
  if (parts.adjustment !== 0) {
    const sign = parts.adjustment < 0 ? '−' : '+'
    terms.push(`${sign}${Math.abs(parts.adjustment)} manual adjustment`)
  }
  const sum = `${terms.join(' ')} = ${parts.derived}`
  return parts.overridden ? `${sum}; overridden to ${parts.override ?? parts.total}` : sum
}
