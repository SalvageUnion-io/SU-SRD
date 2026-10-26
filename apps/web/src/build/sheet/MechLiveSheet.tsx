/**
 * MechLiveSheet — the mech branch of the live sheet (`Sheet` dispatches to
 * it), in the poster layout.
 *
 * The body owns the identity band (Workshop-Manual layout): `MechSheet`
 * renders the `SheetHero` band as its first region. This
 * component's remaining job is the condensed top-bar strip and the Assigned
 * units (`assignedUnitsFor`), handed to `MechSheet` as `linkedUnits`. Push / Heat Check are Guided-Play transactions that live on
 * Play, not the Free-Edit Live Sheet (ADR-021).
 */

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
import { buildSheetCopy } from '../../messages/build-sheet'
import { assignedRail } from './assignedRail'
import { mechStamp } from './bandStamps.model'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { MechSheet } from './MechSheet'
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
  ownerOf,
  store,
  storeState,
  holds,
  hrefFor,
  withheld,
}: MechLiveSheetProps) {
  const pilotAbilities = ownPilotAbilities ?? composition.pilot?.abilities
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
    { key: 'sp', label: buildSheetCopy('sp'), value: sp, max: maxSP },
    { key: 'ep', label: buildSheetCopy('ep'), value: ep, max: maxEP, mobilePriority: false },
    { key: 'heat', label: buildSheetCopy('heat'), value: heat, max: maxHeat },
    {
      key: 'cargo',
      label: buildSheetCopy('hold'),

      value: cargoUsed,
      max: maxCargo,
      mobilePriority: false,
    },
  ]

  // Assigned units: the pilot it carries and the crawler it docks in, both
  // its OWN links (ADR-037), each assigned, changed and unassigned on its own.
  const rail = assignedRail(
    { kind: 'mech', entity: mech },
    { composition, withheld, storeState, holds, hrefFor, ownerOf, editable }
  )

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
              note: buildSheetCopy('thisMechIsDestroyedIts'),
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
