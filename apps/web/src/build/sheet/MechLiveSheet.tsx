/**
 * MechLiveSheet — the mech branch of the live sheet (extracted from
 * Sheet.tsx), in the poster layout.
 *
 * The body owns the identity band (Workshop-Manual layout): `MechSheet`
 * renders the `SheetHero` band as its first region. This
 * component's remaining job is the condensed top-bar strip and composing the
 * assigned-pilot/home-crawler rail content handed to `MechSheet` as
 * `linkedUnits`. Push / Heat Check are Guided-Play transactions that live on
 * Play, not the Free-Edit Live Sheet (ADR-021).
 */

import { containerOf } from 'game-domain/container'
import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import { pilotingContext } from 'game-domain/rules/pilotingContext'
import { totalLotUnits } from 'game-domain/schemas/cargoLot'
import type { Mech } from 'game-domain/schemas/mech'
import { CONDITION_LABELS } from 'salvageunion-reference'
import {
  mechMaxCargo,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  resolveChassisRef,
  resolveGauge,
  resolvePool,
} from 'salvageunion-reference/rules'
import { runWrite } from '../../lib/runWrite'
import { AssignPicker } from '../wiring/AssignPicker'
import type { AssignedSlot, AssignedUnit } from './AssignedUnits'
import { AssignedUnits } from './AssignedUnits'
import { mechStamp } from './bandStamps.model'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { MechSheet } from './MechSheet'
import { crawlerRailItems, pilotRailItems, rowStats } from './railStats.model'
import type { SheetViewCommonProps } from './sheetViewProps.model'

type MechLiveSheetProps = SheetViewCommonProps & {
  mech: Mech
  /**
   * Pilot ability refs to use instead of the composition's — supplied by the
   * public sheet, whose read-only store has no pilot record (ADR-029).
   */
  pilotAbilities?: string[]
}

export function MechLiveSheet({
  mech,
  pilotAbilities: ownPilotAbilities,
  composition,
  actions,
  segments,
  band,
  editable,
  readOnly,
  crawlerReadOnly,
  store,
  storeState,
  hrefFor,
  withheld,
}: MechLiveSheetProps) {
  const pilotAbilities = ownPilotAbilities ?? composition.pilot?.abilities
  const withheldPilot = withheld.find((u) => u.kind === 'pilot')
  const withheldCrawler = withheld.find((u) => u.kind === 'crawler')
  const chassis = resolveChassisRef(mech.chassisRef)
  // Beefcake raises the piloted MECH (ADR-029), so the condensed strip needs
  // the same piloting context the body sheet uses or the two would disagree.
  const piloting = pilotingContext(mech, pilotAbilities)
  const maxSP = mechMaxSP(mech, chassis, piloting)
  const maxEP = mechMaxEP(mech, chassis)
  const maxHeat = mechMaxHeat(mech, chassis)
  const maxCargo = mechMaxCargo(mech, chassis, piloting)
  const cargoUsed = totalLotUnits(mech.cargoLots)
  const sp = resolvePool(mech.currentSP, maxSP)
  const ep = resolvePool(mech.currentEP, maxEP)
  const heat = resolveGauge(mech.currentHeat, maxHeat)

  // On phones the condensed bar leads with Heat + SP; EP/Hold fold
  // until the sm breakpoint.
  const strip: LiveSheetStripItem[] = [
    { key: 'sp', label: 'SP', value: sp, max: maxSP },
    { key: 'ep', label: 'EP', value: ep, max: maxEP, mobilePriority: false },
    { key: 'heat', label: 'Heat', value: heat, max: maxHeat },
    {
      key: 'cargo',
      label: 'Hold',

      value: cargoUsed,
      max: maxCargo,
      mobilePriority: false,
    },
  ]

  // The mech's two assignments are both its OWN links (ADR-037): the pilot it
  // carries (`mech-to-pilot`) and the crawler it docks in (`mech-to-crawler`).
  // Neither is reached through the other, so each slot assigns, changes and
  // unassigns on its own — available whenever the sheet is in Edit, with no
  // confirm (reversible, ADR-007).
  const pilotLinkId = storeState.softLinks.find(
    (l) => l.type === 'mech-to-pilot' && l.from.id === mech.id
  )?.id
  const crawlerLinkId = storeState.softLinks.find(
    (l) => l.type === 'mech-to-crawler' && l.from.id === mech.id
  )?.id
  const unassign = (linkId: string | undefined) =>
    editable && linkId ? () => runWrite(() => storeState.delete('softLink', linkId)) : undefined
  // Both slots pick from where the mech lives — its Game, or your shelves.
  const self = { type: 'mech', id: mech.id } as const
  const container = containerOf(mech)

  // Assigned units: each a contentful Mini with its vitals, the same in Read
  // and Edit; Edit adds Change and Unassign after it, and Assign / + Create for an
  // empty place.
  const units: AssignedUnit[] = []
  if (composition.pilot) {
    units.push({
      key: 'pilot',
      kind: 'pilot',
      name: composition.pilot.name,
      readings: rowStats(
        pilotRailItems(
          composition.pilot,
          resolveEffectiveCrawlerLevel(composition.pilot, composition.crawler)
        )
      ),
      href: hrefFor('pilot', composition.pilot.id),
      change: (
        <AssignPicker
          subject={self}
          container={container}
          pick="pilot"
          filled
          exclude={[composition.pilot.id]}
        />
      ),
      onUnassign: unassign(pilotLinkId),
    })
  } else if (withheldPilot) {
    units.push({ key: 'pilot', kind: 'pilot', name: withheldPilot.name ?? 'Not shared' })
  }
  if (composition.crawler) {
    units.push({
      key: 'crawler',
      kind: 'crawler',
      name: composition.crawler.name,
      readings: rowStats(crawlerRailItems(composition.crawler)),
      href: hrefFor('crawler', composition.crawler.id),
      change: (
        <AssignPicker
          subject={self}
          container={container}
          pick="crawler"
          filled
          exclude={[composition.crawler.id]}
        />
      ),
      onUnassign: unassign(crawlerLinkId),
    })
  } else if (withheldCrawler) {
    units.push({ key: 'crawler', kind: 'crawler', name: withheldCrawler.name ?? 'Not shared' })
  }
  const slots: AssignedSlot[] = [
    ...(composition.pilot || withheldPilot
      ? []
      : [
          {
            key: 'pilot',
            kind: 'pilot' as const,
            assign: <AssignPicker subject={self} container={container} pick="pilot" size="mini" />,
          },
        ]),
    ...(composition.crawler || withheldCrawler
      ? []
      : [
          {
            key: 'crawler',
            kind: 'crawler' as const,
            assign: (
              <AssignPicker subject={self} container={container} pick="crawler" size="mini" />
            ),
          },
        ]),
  ]
  const rail = <AssignedUnits units={units} slots={slots} editable={editable} />

  return (
    <LiveSheet
      variant="mech"
      name={mech.name}
      quoted
      strip={strip}
      segments={segments}
      band={band}
      source={mech.seedRef ? 'starter' : mech.sourcePattern ? 'homebrew' : undefined}
      kindDetail={mechStamp(mech.chassisRef)}
      out={
        mech.destroyed
          ? {
              stamp: CONDITION_LABELS.destroyed,
              note: 'This Mech is destroyed. Its record stays: clear Destroyed under Conditions if this was a bookkeeping error.',
            }
          : undefined
      }
      actions={actions}
      renderBody={() => (
        <MechSheet
          mech={mech}
          store={store}
          readOnly={readOnly}
          crawler={composition.crawler}
          crawlerReadOnly={crawlerReadOnly}
          crawlerHref={composition.crawler ? hrefFor('crawler', composition.crawler.id) : undefined}
          linkedUnits={rail}
          pilotAbilities={pilotAbilities}
        />
      )}
    />
  )
}
