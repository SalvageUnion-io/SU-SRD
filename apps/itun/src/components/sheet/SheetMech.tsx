/**
 * SheetMech — the mech branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19; redesigned to the poster layout, Phase 2).
 *
 * The body owns the identity band (Workshop-Manual layout): `MechSheet`
 * renders the `SheetHero` band as its first region. This
 * component's remaining job is the condensed top-bar strip and composing the
 * assigned-pilot/home-crawler rail content handed to `MechSheet` as
 * `linkedUnits`. Push / Heat Check are Guided-Play transactions that live on
 * the Dashboard, not the Free-Edit Live Sheet (ADR-021).
 */

import { EntityRow } from 'component-lib'
import { resolveChassisRef, resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import { containerOf } from '../../lib/container'
import { mechMaxCargo, mechMaxEP, mechMaxHeat, mechMaxSP } from '../../lib/rules/derivedStats'
import { pilotingContext } from '../../lib/rules/pilotingContext'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Mech } from '../../lib/schemas/mech'
import { DashboardChooser } from '../dashboard/DashboardChooser'
import { AppLink } from '../shared/AppLink'
import { AssignPilotToMech } from '../wiring/AssignPilotToMech'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { MechSheet } from './MechSheet'
import { crawlerRailItems, pilotRailItems, rowStats } from './railStats'
import { RailCta } from './SheetRailParts'
import type { SheetViewCommonProps } from './sheetViewProps'
import { runWrite } from './sheetWrite'

type SheetMechProps = SheetViewCommonProps & {
  mech: Mech
  /**
   * Pilot ability refs to use instead of the composition's — supplied by a
   * published snapshot, whose read-only store has no pilot record (ADR-029).
   */
  pilotAbilitiesOverride?: string[]
}

export function SheetMech({
  mech,
  pilotAbilitiesOverride,
  composition,
  back,
  actions,
  segments,
  editable,
  readOnly,
  store,
  storeState,
}: SheetMechProps) {
  const chassis = resolveChassisRef(mech.chassisRef)
  // Beefcake raises the piloted MECH (ADR-029), so the condensed strip needs
  // the same piloting context the body sheet uses or the two would disagree.
  const piloting = pilotingContext(mech, pilotAbilitiesOverride ?? composition.pilot?.abilities)
  const maxSP = mechMaxSP(mech, chassis, piloting)
  const maxEP = mechMaxEP(mech, chassis)
  const maxHeat = mechMaxHeat(mech, chassis)
  const maxCargo = mechMaxCargo(mech, chassis, piloting)
  const cargoUsed = totalLotUnits(mech.cargoLots)
  const sp = resolvePool(mech.currentSP, maxSP)
  const ep = resolvePool(mech.currentEP, maxEP)
  const heat = resolveGauge(mech.currentHeat, maxHeat)

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

  // Unassign for the mech's own direct link (mech-to-pilot) — always
  // available on editable sheets per the unified edit language (no edit
  // mode). The crawler chip is transitive (the pilot's crawler), nav-only.
  const pilotLinkId = storeState.softLinks.find(
    (l) => l.type === 'mech-to-pilot' && l.from.id === mech.id
  )?.id
  const unassignPilot =
    editable && pilotLinkId
      ? () => runWrite(() => storeState.delete('softLink', pilotLinkId))
      : undefined

  // Linked Units rail content (poster R4, span 5) — built here because it
  // needs `composition` (resolved pilot/crawler), which MechSheet does not
  // receive; handed down as `linkedUnits`.
  const rail = (
    <>
      {composition.pilot ? (
        <EntityRow
          entityType="pilot"
          className="flex-[1_1_0%]"
          name={composition.pilot.name}
          sheetHref={`/sheet/pilot/${composition.pilot.id}`}
          linkAs={AppLink}
          meta="Assigned Pilot"
          stats={rowStats(pilotRailItems(composition.pilot))}
          onDeleteClick={unassignPilot}
        />
      ) : (
        <EntityRow
          empty
          entityType="pilot"
          className="flex-[1_1_0%]"
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
        <EntityRow
          entityType="crawler"
          className="flex-[1_1_0%]"
          name={composition.crawler.name}
          sheetHref={`/sheet/crawler/${composition.crawler.id}`}
          linkAs={AppLink}
          meta="Home Crawler"
          stats={rowStats(crawlerRailItems(composition.crawler))}
        />
      ) : (
        <EntityRow
          empty
          entityType="crawler"
          className="flex-[1_1_0%]"
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
      segments={segments}
      syncStats={{ cargo: cargoUsed }}
      actions={
        editable ? (
          <>
            <DashboardChooser initialMechId={mech.id} activeContainer={containerOf(mech)} />
            {actions}
          </>
        ) : (
          actions
        )
      }
      renderBody={() => (
        <MechSheet
          mech={mech}
          store={store}
          readOnly={readOnly}
          crawler={composition.crawler}
          linkedUnits={rail}
          pilotAbilities={pilotAbilitiesOverride ?? composition.pilot?.abilities}
        />
      )}
    />
  )
}
