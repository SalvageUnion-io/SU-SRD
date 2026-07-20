/**
 * SheetRailParts — the linked-entity rail chip bodies and status helpers
 * shared by the three sheet views (extracted from Sheet.tsx, audit item 19).
 * Pure presentational: live mini stats read the passed record, never the
 * store.
 *
 * Rail stats render as INLINE NUMERIC TEXT (poster `.rail-body`, e.g.
 * "SP 9/13 · EP 6/11 · Heat 4/12") — never `VitalGauge`/`StatBlock` pips
 * (redesign gap G10).
 */

import type { BadgeTone, StatLineItem, StatState } from 'component-lib'

import {
  crawlerMaxSP,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
} from '../../lib/rules/derivedStats'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'

/** Anchor CTA for rail empty slots ('+ Create'). */
export function RailCta({
  href,
  label,
  primary,
}: {
  href: string
  label: string
  primary?: boolean
}) {
  return (
    <AppLink
      href={href}
      className={cn(
        'rounded-[3px] border-chrome px-2.5 py-1.5 text-center font-body text-xs font-medium no-underline transition-colors duration-[120ms]',
        primary
          ? 'border-rust bg-rust text-paper hover:bg-rust-hi'
          : 'border-ink bg-paper text-ink hover:bg-wk-bg-2'
      )}
    >
      {label}
    </AppLink>
  )
}

/**
 * Rail vitals as `StatLine` items — plain builders, NOT components.
 *
 * These were three components that each hand-wrote the same inline markup and
 * differed only in WHICH stats they listed. Collapsing the markup onto the
 * shared `StatLine` atom left them as thin wrappers that added nothing but a
 * name, so they are functions now: a call site renders `StatLine` itself and
 * these just supply the numbers.
 *
 * The rules math stays here rather than moving into component-lib, which is
 * data-source agnostic (ADR-010).
 */

/** Mech rail vitals: "SP 9/13 · EP 6/11 · Heat 4/12". */
export function mechRailItems(mech: Mech): StatLineItem[] {
  const maxSP = mechMaxSP(mech)
  const maxEP = mechMaxEP(mech)
  const maxHeat = mechMaxHeat(mech)
  return [
    { label: 'SP', value: mech.currentSP ?? maxSP, max: maxSP },
    { label: 'EP', value: mech.currentEP ?? maxEP, max: maxEP },
    { label: 'Heat', value: mech.currentHeat ?? maxHeat, max: maxHeat },
  ]
}

/** Pilot rail vitals: "HP 7/10 · AP 4/6". */
export function pilotRailItems(pilot: Pilot): StatLineItem[] {
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  return [
    { label: 'HP', value: pilot.currentHP ?? maxHP, max: maxHP },
    { label: 'AP', value: pilot.currentAP ?? maxAP, max: maxAP },
  ]
}

/** Crawler rail vitals: "SP 9/13 · Bays 4/5 Intact". */
export function crawlerRailItems(crawler: Crawler): StatLineItem[] {
  const maxSP = crawlerMaxSP(crawler)
  const states = bayStates(crawler)
  const intact = states.filter((s) => s === 'intact').length
  return [
    { label: 'SP', value: crawler.currentSP ?? maxSP, max: maxSP },
    // Bays only appear once the crawler HAS bays — an empty "Bays 0/0" line was
    // never rendered before and must not start now.
    ...(states.length > 0
      ? [{ label: 'Bays', value: intact, max: states.length, suffix: 'Intact' }]
      : []),
  ]
}

/** Bay conditions as StatBlock pip states (Intact/Damaged only, rules C8). */
// biome-ignore lint/style/useComponentExportOnlyModules: shared control helpers, colocated by design (audit items 24/19)
export function bayStates(crawler: Crawler): StatState[] {
  return (crawler.crawlerBays ?? []).map((bay) => bay.condition ?? 'intact')
}

/** Destroyed > Damaged > Intact status pill for a mech. */
// biome-ignore lint/style/useComponentExportOnlyModules: shared control helpers, colocated by design (audit items 24/19)
export function mechStatusPill(mech: Mech): { label: string; tone: BadgeTone } {
  if (mech.destroyed) return { label: 'Destroyed', tone: 'bad' }
  const anyDamaged = [
    ...Object.values(mech.systemConditions ?? {}),
    ...Object.values(mech.moduleConditions ?? {}),
  ].some((c) => c !== 'intact')
  return anyDamaged ? { label: 'Damaged', tone: 'warn' } : { label: 'Intact', tone: 'ok' }
}
