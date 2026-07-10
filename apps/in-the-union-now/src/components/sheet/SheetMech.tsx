/**
 * SheetMech — the mech branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19; redesigned to the poster layout, phase 2).
 * Hero top region = IDENTITY block (pattern name prominent, chassis + Tech
 * Level as labeled secondary meta, with the section's own Edit button) plus
 * the full chassis-stats strip as real StatBlocks, vs the VITALS cluster
 * (SP/EP/Heat current-max gauges + conditions) on the right; rail = assigned
 * pilot + home crawler; body = MechSheet; FAB carries Push (R-6/U-3).
 */

import { VitalGauge, heatDangerFrom } from 'suref-react'

import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { computeMechCapacity } from '../../lib/rules/capacity'
import { describePushOutcome } from '../../lib/rules/coreMechanic'
import { mechMaxCargo, mechMaxEP, mechMaxHeat, mechMaxSP } from '../../lib/rules/derivedStats'
import { defaultRoll, heatCheckPatch, performPush } from '../../lib/rules/heatCheck'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Mech } from '../../lib/schemas/mech'
import { AssignPilotToMech } from '../wiring/AssignPilotToMech'
import { LiveSheet } from './LiveSheet'
import type { LiveSheetStripItem } from './LiveSheet'
import { MechConditionsEditor } from './MechConditionsEditor'
import { MechIdentityPanel } from './MechIdentity'
import { MechSheet } from './MechSheet'
import { QuickRollFab } from './QuickRollFab'
import { ChassisStats, SheetHero } from './SheetHero'
import type { ChassisStatItem } from './SheetHero'
import { RailChip, RailEmpty } from './SheetRail'
import { CrawlerRailStats, PilotRailStats, RailCta, mechStatusPill } from './SheetRailParts'
import type { SheetViewCommonProps } from './sheetViewProps'

type SheetMechProps = SheetViewCommonProps & { mech: Mech }

export function SheetMech({
  mech,
  composition,
  wired,
  back,
  actions,
  segments,
  editable,
  readOnly,
  store,
  storeState,
  lookup,
  patch,
}: SheetMechProps) {
  const chassis = resolveChassisRef(mech.chassisRef)
  const maxSP = mechMaxSP(mech, chassis)
  const maxEP = mechMaxEP(mech, chassis)
  const maxHeat = mechMaxHeat(mech, chassis)
  const maxCargo = mechMaxCargo(mech, chassis)
  const cargoUsed = totalLotUnits(mech.cargoLots)
  const sp = Math.min(mech.currentSP ?? maxSP, maxSP)
  const ep = Math.min(mech.currentEP ?? maxEP, maxEP)
  const heat = Math.min(mech.currentHeat ?? maxHeat, maxHeat)

  const capacity = computeMechCapacity({
    chassisRef: mech.chassisRef,
    systems: mech.systems.map((ref) => ({ ref })),
    modules: mech.modules.map((ref) => ({ ref })),
  })

  // Poster chassis-stats strip — the capacities the live VITALS gauges do NOT
  // already surface (slot/salvage/cargo). SP/EP/Heat maxima live on the
  // right-column current-max gauges, and Tech Level is the labeled identity
  // meta in MechIdentityPanel, so neither is repeated here.
  const specs: ChassisStatItem[] = [
    {
      code: 'SYS',
      name: 'Slots',
      value: capacity.systemSlotsUsed,
      max: capacity.systemSlotsMax,
      pips: capacity.systemSlotsMax <= 12,
    },
    {
      code: 'MOD',
      name: 'Slots',
      value: capacity.moduleSlotsUsed,
      max: capacity.moduleSlotsMax,
      pips: capacity.moduleSlotsMax <= 12,
    },
    {
      code: 'CARGO',
      name: 'Cap',
      value: cargoUsed,
      max: maxCargo,
      pips: maxCargo > 0 && maxCargo <= 12,
    },
    ...(typeof chassis?.salvageValue === 'number'
      ? [{ code: 'SV', name: 'Salvage', value: chassis.salvageValue }]
      : []),
  ]

  // U-5: on phones the condensed bar leads with Heat + SP; EP/Hold fold
  // until the sm breakpoint.
  const strip: LiveSheetStripItem[] = [
    { key: 'sp', label: 'SP', stat: 'sp', value: sp, max: maxSP },
    { key: 'ep', label: 'EP', stat: 'ep', value: ep, max: maxEP, mobilePriority: false },
    { key: 'heat', label: 'Heat', stat: 'heat', value: heat, max: maxHeat },
    {
      key: 'cargo',
      label: 'Hold',
      stat: 'cargo',
      value: cargoUsed,
      max: maxCargo,
      mobilePriority: false,
    },
  ]

  // Quick Ref p.233: "Can't Push if it'd take you over your Heat Cap" —
  // the FAB's Push is disabled (never clamped) when +2 Heat would exceed it.
  const pushLocked =
    heat + 2 > maxHeat
      ? `Can't Push at Heat ${heat}/${maxHeat} — +2 Heat would take the mech over its Heat Cap (p.233).`
      : undefined

  /**
   * Push (design review R-6/U-3): +2 Heat then an immediate Heat Check,
   * written through the store exactly like HeatCheckControl (ADR-007 —
   * deterministic bookkeeping auto-applies; marking a destroyed System or
   * Module stays a player call via its status badge). Reads the freshest
   * mech so rapid sequential actions don't stomp each other.
   */
  async function pushMech(): Promise<string> {
    const fresh = lookup.get('mech', mech.id) ?? mech
    const cap = mechMaxHeat(fresh, chassis)
    const freshMaxSP = mechMaxSP(fresh, chassis)
    const { nextHeat, effect } = performPush({
      heat: Math.min(fresh.currentHeat ?? cap, cap),
      heatCap: cap,
      currentSP: Math.min(fresh.currentSP ?? freshMaxSP, freshMaxSP),
      roll: defaultRoll,
    })
    await storeState.update('mech', mech.id, heatCheckPatch(effect, nextHeat))
    return describePushOutcome(nextHeat, effect)
  }

  // Unassign for the mech's own direct link (mech-to-pilot) — always
  // available on editable sheets per the unified edit language (no edit
  // mode). The crawler chip is transitive (the pilot's crawler), nav-only.
  const pilotLinkId = storeState.softLinks.find(
    (l) => l.type === 'mech-to-pilot' && l.from.id === mech.id
  )?.id
  const unassignPilot =
    editable && pilotLinkId ? () => void storeState.delete('softLink', pilotLinkId) : undefined

  const rail = (
    <>
      {composition.pilot ? (
        <RailChip
          tone="pilot"
          roleLabel="Assigned Pilot"
          name={composition.pilot.name}
          href={`/sheet/pilot/${composition.pilot.id}`}
          status={{ label: 'Active', tone: 'pilot' }}
          stats={<PilotRailStats pilot={composition.pilot} />}
          onUnassign={unassignPilot}
        />
      ) : (
        <RailEmpty
          tone="pilot"
          roleLabel="Assigned Pilot"
          message="No pilot assigned. Link a pilot to speak for this machine."
          actions={
            editable ? (
              <>
                <RailCta href="/pilots/new" label="+ Create" primary />
                <AssignPilotToMech mechId={mech.id} />
              </>
            ) : undefined
          }
        />
      )}
      {composition.crawler ? (
        <RailChip
          tone="crawler"
          roleLabel="Home Crawler"
          name={composition.crawler.name}
          href={`/sheet/crawler/${composition.crawler.id}`}
          tl={parseCrawlerTechLevel(composition.crawler.techLevel)}
          stats={<CrawlerRailStats crawler={composition.crawler} />}
        />
      ) : (
        <RailEmpty
          tone="crawler"
          roleLabel="Home Crawler"
          message="No crawler linked — the assigned pilot's home crawler appears here."
          actions={editable ? <RailCta href="/crawlers/new" label="+ Create" primary /> : undefined}
        />
      )}
    </>
  )

  return (
    <LiveSheet
      variant="mech"
      name={mech.name}
      strip={strip}
      back={back}
      pill={mechStatusPill(mech)}
      wired={wired}
      rail={rail}
      segments={segments}
      syncStats={{ cargo: cargoUsed }}
      actions={actions}
      fab={editable ? <QuickRollFab onPush={pushMech} pushLocked={pushLocked} /> : undefined}
      renderHero={({ heroRef, rail: heroRail }) => (
        <SheetHero
          heroRef={heroRef}
          cat="Mech"
          name={mech.name}
          identityBlock={
            // Poster region 1 (left): identity fields first, then the full
            // chassis-stats strip beneath them (real sm StatBlocks).
            <div className="flex min-w-0 flex-col gap-3">
              <MechIdentityPanel
                mech={mech}
                chassisName={chassis?.name ?? mech.chassisRef}
                techLevel={typeof chassis?.techLevel === 'number' ? chassis.techLevel : undefined}
                patch={editable ? patch : undefined}
              />
              <div>
                <ChassisStats items={specs} />
              </div>
            </div>
          }
          trackers={
            <>
              <VitalGauge
                label="SP"
                subLabel="Structure"
                value={sp}
                max={maxSP}
                onChange={editable ? (v) => patch({ currentSP: v }) : undefined}
                readOnly={!editable}
              />
              <VitalGauge
                label="EP"
                subLabel="Energy"
                value={ep}
                max={maxEP}
                onChange={editable ? (v) => patch({ currentEP: v }) : undefined}
                readOnly={!editable}
              />
              <VitalGauge
                label="Heat"
                value={heat}
                max={maxHeat}
                danger={maxHeat > 0 ? heatDangerFrom(maxHeat) : undefined}
                onChange={editable ? (v) => patch({ currentHeat: v }) : undefined}
                readOnly={!editable}
              />
            </>
          }
          inset={
            <div className="flex w-full max-w-[360px] flex-col items-stretch gap-1">
              <span className="font-cond text-label font-bold uppercase tracking-caps text-ink">
                Conditions
              </span>
              <MechConditionsEditor mech={mech} store={store} readOnly={readOnly} />
            </div>
          }
          rail={heroRail}
        />
      )}
      renderBody={() => (
        <MechSheet mech={mech} store={store} readOnly={readOnly} crawler={composition.crawler} />
      )}
    />
  )
}
