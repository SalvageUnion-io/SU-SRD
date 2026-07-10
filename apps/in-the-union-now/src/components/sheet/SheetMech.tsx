/**
 * SheetMech — the mech branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19; redesigned to the poster layout, Phase 2).
 *
 * The hero now carries ONLY the name row + meta (poster region grid, D7):
 * Identity, Vitals and the linked-unit rail all moved into the body's R1/R4
 * poster regions (see `MechSheet`) — SheetHero no longer receives
 * `identityBlock`/`trackers`/`inset`/`rail`, mirroring SheetPilot. This
 * component's remaining job is the condensed top-bar strip, the Push FAB, and
 * composing the assigned-pilot/home-crawler rail content handed to
 * `MechSheet` as `linkedUnits`.
 */

import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { describePushOutcome } from '../../lib/rules/coreMechanic'
import { mechMaxCargo, mechMaxEP, mechMaxHeat, mechMaxSP } from '../../lib/rules/derivedStats'
import { defaultRoll, heatCheckPatch, performPush } from '../../lib/rules/heatCheck'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Mech } from '../../lib/schemas/mech'
import { AssignPilotToMech } from '../wiring/AssignPilotToMech'
import { LiveSheet } from './LiveSheet'
import type { LiveSheetStripItem } from './LiveSheet'
import { MechSheet } from './MechSheet'
import { QuickRollFab } from './QuickRollFab'
import { SheetHero } from './SheetHero'
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
   * written through the store (ADR-007 — deterministic bookkeeping
   * auto-applies; marking a destroyed System or Module stays a player call
   * via its status badge). Reads the freshest mech so rapid sequential
   * actions don't stomp each other.
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

  // Linked Units rail content (poster R4, span 5) — built here because it
  // needs `composition` (resolved pilot/crawler), which MechSheet does not
  // receive; handed down as `linkedUnits`.
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
      segments={segments}
      syncStats={{ cargo: cargoUsed }}
      actions={actions}
      fab={editable ? <QuickRollFab onPush={pushMech} pushLocked={pushLocked} /> : undefined}
      renderHero={({ heroRef }) => <SheetHero heroRef={heroRef} cat="Mech" name={mech.name} />}
      renderBody={() => (
        <MechSheet
          mech={mech}
          store={store}
          readOnly={readOnly}
          crawler={composition.crawler}
          linkedUnits={rail}
        />
      )}
    />
  )
}
