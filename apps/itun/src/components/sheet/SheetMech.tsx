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
import {
  mechMaxCargo,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  resolveChassisRef,
  resolveGauge,
  resolvePool,
} from 'salvageunion-reference/rules'
import { containerOf } from '../../lib/container'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { pilotingContext } from '../../lib/rules/pilotingContext'
import { runWrite } from '../../lib/runWrite'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Mech } from '../../lib/schemas/mech'
import { AppLink } from '../shared/AppLink'
import { AssignPicker } from '../wiring/AssignPicker'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { MechSheet } from './MechSheet'
import { crawlerRailItems, pilotRailItems, rowStats } from './railStats'
import { RailCta, WithheldUnitRow } from './SheetRailParts'
import type { SheetViewCommonProps } from './sheetViewProps'

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
  crawlerReadOnly,
  store,
  storeState,
  lookup,
  hrefFor,
  withheld,
}: SheetMechProps) {
  const withheldPilot = withheld.find((u) => u.kind === 'pilot')
  const withheldCrawler = withheld.find((u) => u.kind === 'crawler')
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

  // The mech's two assignments are both its OWN links (ADR-037): the pilot it
  // carries (`mech-to-pilot`) and the crawler it docks in (`mech-to-crawler`).
  // Neither is reached through the other, so each slot assigns, changes and
  // unassigns on its own — always available on editable sheets per the unified
  // edit language (no edit mode), with no confirm (reversible, ADR-007).
  const pilotLinkId = storeState.softLinks.find(
    (l) => l.type === 'mech-to-pilot' && l.from.id === mech.id
  )?.id
  const crawlerLinkId = storeState.softLinks.find(
    (l) => l.type === 'mech-to-crawler' && l.from.id === mech.id
  )?.id
  const unassign = (linkId: string | undefined) =>
    editable && linkId ? () => runWrite(() => storeState.delete('softLink', linkId)) : undefined
  // Both slots pick from where the mech lives — its Game, or My Stuff.
  const self = { type: 'mech', id: mech.id } as const
  const container = containerOf(mech)

  // The pilot's Stat Training follows the PILOT's crawler, not this mech's:
  // the two are assigned independently, so a mech docked in one crawler can
  // carry a pilot who crews another.
  const pilotCrawlerId = composition.pilot
    ? storeState.softLinks.find(
        (l) => l.type === 'pilot-to-crawler' && l.from.id === composition.pilot?.id
      )?.to.id
    : undefined
  const pilotCrawler = pilotCrawlerId ? lookup.get('crawler', pilotCrawlerId) : null

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
          sheetHref={hrefFor('pilot', composition.pilot.id)}
          linkAs={AppLink}
          meta="Assigned Pilot"
          stats={rowStats(
            pilotRailItems(
              composition.pilot,
              resolveEffectiveCrawlerLevel(composition.pilot, pilotCrawler)
            )
          )}
          actions={
            editable ? (
              <AssignPicker
                subject={self}
                container={container}
                pick="pilot"
                filled
                exclude={[composition.pilot.id]}
                size="mini"
              />
            ) : undefined
          }
          onUnassignClick={unassign(pilotLinkId)}
        />
      ) : withheldPilot ? (
        <WithheldUnitRow unit={withheldPilot} label="Assigned Pilot" />
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
                <AssignPicker subject={self} container={container} pick="pilot" />
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
          sheetHref={hrefFor('crawler', composition.crawler.id)}
          linkAs={AppLink}
          meta="Home Crawler"
          stats={rowStats(crawlerRailItems(composition.crawler))}
          actions={
            editable ? (
              <AssignPicker
                subject={self}
                container={container}
                pick="crawler"
                filled
                exclude={[composition.crawler.id]}
                size="mini"
              />
            ) : undefined
          }
          onUnassignClick={unassign(crawlerLinkId)}
        />
      ) : withheldCrawler ? (
        <WithheldUnitRow unit={withheldCrawler} label="Home Crawler" />
      ) : (
        <EntityRow
          empty
          entityType="crawler"
          className="flex-[1_1_0%]"
          roleLabel="Home Crawler"
          message="No crawler assigned. A mech docks by its own assignment, separately from its pilot."
          actions={
            editable ? (
              <>
                <RailCta href="/crawlers/new" label="+ Create" primary />
                <AssignPicker subject={self} container={container} pick="crawler" />
              </>
            ) : undefined
          }
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
      actions={actions}
      renderBody={() => (
        <MechSheet
          mech={mech}
          store={store}
          readOnly={readOnly}
          crawler={composition.crawler}
          crawlerReadOnly={crawlerReadOnly}
          linkedUnits={rail}
          pilotAbilities={pilotAbilitiesOverride ?? composition.pilot?.abilities}
        />
      )}
    />
  )
}
