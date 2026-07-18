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

import type { BadgeTone, StatState } from 'component-lib'

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

/** Live mini stats for a linked mech (rail chip body): "SP 9/13 · EP 6/11 · Heat 4/12". */
export function MechRailStats({ mech }: { mech: Mech }) {
  const maxSP = mechMaxSP(mech)
  const maxEP = mechMaxEP(mech)
  const maxHeat = mechMaxHeat(mech)
  const sp = mech.currentSP ?? maxSP
  const ep = mech.currentEP ?? maxEP
  const heat = mech.currentHeat ?? maxHeat
  return (
    <>
      SP{' '}
      <b>
        {sp}/{maxSP}
      </b>{' '}
      &middot; EP{' '}
      <b>
        {ep}/{maxEP}
      </b>{' '}
      &middot; Heat{' '}
      <b>
        {heat}/{maxHeat}
      </b>
    </>
  )
}

/** Live mini stats for a linked pilot (rail chip body): "HP 7/10 · AP 4/6". */
export function PilotRailStats({ pilot }: { pilot: Pilot }) {
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  const hp = pilot.currentHP ?? maxHP
  const ap = pilot.currentAP ?? maxAP
  return (
    <>
      HP{' '}
      <b>
        {hp}/{maxHP}
      </b>{' '}
      &middot; AP{' '}
      <b>
        {ap}/{maxAP}
      </b>
    </>
  )
}

/** Live mini stats for a linked crawler (rail chip body): "SP 9/13 · Bays 4/5 Intact". */
export function CrawlerRailStats({ crawler }: { crawler: Crawler }) {
  const maxSP = crawlerMaxSP(crawler)
  const sp = crawler.currentSP ?? maxSP
  const states = bayStates(crawler)
  const intact = states.filter((s) => s === 'intact').length
  return (
    <>
      SP{' '}
      <b>
        {sp}/{maxSP}
      </b>
      {states.length > 0 && (
        <>
          {' '}
          &middot; Bays{' '}
          <b>
            {intact}/{states.length}
          </b>{' '}
          Intact
        </>
      )}
    </>
  )
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
