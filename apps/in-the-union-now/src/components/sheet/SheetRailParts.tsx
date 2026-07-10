/**
 * SheetRailParts — the linked-entity rail chip bodies and status helpers
 * shared by the three sheet views (extracted from Sheet.tsx, audit item 19).
 * Pure presentational: live mini stats read the passed record, never the
 * store.
 */

import { StatBlock } from 'suref-react'
import type { PillTone, StatBlockState } from 'suref-react'

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
          ? 'border-rust bg-rust text-su-white hover:bg-rust-hi'
          : 'border-ink bg-paper text-ink hover:bg-wk-bg-2'
      )}
    >
      {label}
    </AppLink>
  )
}

/** Live mini stats for a linked mech (rail chip body). */
export function MechRailStats({ mech }: { mech: Mech }) {
  const maxSP = mechMaxSP(mech)
  const maxEP = mechMaxEP(mech)
  const maxHeat = mechMaxHeat(mech)
  return (
    <>
      <StatBlock
        code="SP"
        size="sm"
        stat="sp"
        value={mech.currentSP ?? maxSP}
        max={maxSP}
        editable={false}
      />
      <StatBlock
        code="EP"
        size="sm"
        stat="ep"
        value={mech.currentEP ?? maxEP}
        max={maxEP}
        editable={false}
      />
      <StatBlock
        code="HEAT"
        size="sm"
        stat="heat"
        value={mech.currentHeat ?? maxHeat}
        max={maxHeat}
        editable={false}
      />
    </>
  )
}

/** Live mini stats for a linked pilot (rail chip body). */
export function PilotRailStats({ pilot }: { pilot: Pilot }) {
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  return (
    <>
      <StatBlock
        code="HP"
        size="sm"
        stat="hp"
        value={pilot.currentHP ?? maxHP}
        max={maxHP}
        editable={false}
      />
      <StatBlock
        code="AP"
        size="sm"
        stat="ap"
        value={pilot.currentAP ?? maxAP}
        max={maxAP}
        editable={false}
      />
    </>
  )
}

/** Live mini stats for a linked crawler (rail chip body). */
export function CrawlerRailStats({ crawler }: { crawler: Crawler }) {
  const maxSP = crawlerMaxSP(crawler)
  const states = bayStates(crawler)
  return (
    <>
      <StatBlock
        code="SP"
        size="sm"
        stat="sp"
        value={crawler.currentSP ?? maxSP}
        max={maxSP}
        editable={false}
      />
      {states.length > 0 && <StatBlock code="BAYS" size="sm" states={states} />}
    </>
  )
}

/** Bay conditions as StatBlock pip states (Intact/Damaged only, rules C8). */
// biome-ignore lint/style/useComponentExportOnlyModules: shared control helpers, colocated by design (audit items 24/19)
export function bayStates(crawler: Crawler): StatBlockState[] {
  return (crawler.crawlerBays ?? []).map((bay) => bay.condition ?? 'intact')
}

/** Destroyed > Damaged > Intact status pill for a mech. */
// biome-ignore lint/style/useComponentExportOnlyModules: shared control helpers, colocated by design (audit items 24/19)
export function mechStatusPill(mech: Mech): { label: string; tone: PillTone } {
  if (mech.destroyed) return { label: 'Destroyed', tone: 'bad' }
  const anyDamaged = [
    ...Object.values(mech.systemConditions ?? {}),
    ...Object.values(mech.moduleConditions ?? {}),
  ].some((c) => c !== 'intact')
  return anyDamaged ? { label: 'Damaged', tone: 'warn' } : { label: 'Intact', tone: 'ok' }
}
