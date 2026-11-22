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

import { mechHasCondition } from 'game-domain/rules/crewStatus'
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
import { Stat } from '../../components/index'
import { mechScrap, scrapSplit } from '../../lib/rules/mechScrap'
import { usePatternElsewhere, usePatternGone } from '../../lib/sharing/reads'
import { buildSheetCopy } from '../../messages/build-sheet'
import { usePatterns } from '../../replica/collections'
import { useSync } from '../../replica/syncContext'
import { assignedRail } from './assignedRail'
import { mechPatternStamp, mechStamp } from './bandStamps.model'
import { ChangeChassis } from './chassisControls'
import { LiveSheet } from './LiveSheet'
import { MechSheet } from './MechSheet'
import { mechBarStrip } from './mechBarStrip.model'
import { PatternCatchUp } from './PatternCatchUp'
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
  liveInRead = false,
  crawlerReadOnly,
  ownerOf,
  store,
  storeState,
  holds,
  hrefFor,
  withheld,
  patch,
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

  const strip = mechBarStrip({
    building: editable && !readOnly,
    mech,
    vitals: [
      { key: 'sp', label: buildSheetCopy('sp'), value: sp, max: maxSP },
      { key: 'ep', label: buildSheetCopy('ep'), value: ep, max: maxEP, mobilePriority: false },
      { key: 'heat', label: buildSheetCopy('heat'), value: heat, max: maxHeat },
    ],
    cargo: { value: cargoUsed, max: maxCargo },
  })

  // Related units: the pilot it carries and the crawler it docks in, both
  // its OWN links (ADR-037), each assigned, changed and unassigned on its own.
  const savedPatterns = usePatterns((s) => s.mechPatterns)
  // A pattern this account does not hold may be a crewmate's, or one since
  // deleted: asked only once the account's own patterns are in, on a sheet
  // its viewer writes (a public sheet's reader asks nothing).
  const patternsIn = usePatterns((s) => s.hydrated)
  const notHeld =
    mech.sourcePattern !== undefined && !savedPatterns.some((p) => p.id === mech.sourcePattern)
  const { status } = useSync()
  const askElsewhere = liveInRead && patternsIn && notHeld && status === 'live'
  const patternGone = usePatternGone(mech.sourcePattern, askElsewhere)
  // Someone else's pattern, by its link or a crew's: named, not "A saved pattern" (r5 D3).
  const elsewhere = usePatternElsewhere(mech.sourcePattern, askElsewhere)
  const fromPattern = mechPatternStamp(
    mech,
    (id) =>
      savedPatterns.find((p) => p.id === id) ?? (id === mech.sourcePattern ? elsewhere : undefined),
    patternGone
  )
  const rail = assignedRail(
    { kind: 'mech', entity: mech },
    { composition, withheld, storeState, holds, hrefFor, ownerOf, editable, liveInRead }
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
      // Change Chassis sits where the chassis is named (r4 E17).
      // Bring up to date beside it once the loadout is no longer the pattern's (r5 D2).
      kindAction={
        editable && mech.chassisRef !== '' ? (
          <>
            <ChangeChassis mech={mech} patch={patch} />
            {fromPattern?.loadout && (
              <PatternCatchUp
                mech={mech}
                stamp={{ ...fromPattern, loadout: fromPattern.loadout }}
                patch={patch}
              />
            )}
          </>
        ) : undefined
      }
      fromPattern={fromPattern}
      // Read's header strip carries TL and
      // SV with the chassis's other figures, so the band leaves them out (R59).
      rank={readOnly ? undefined : <MechBandRank mech={mech} />}
      out={
        mechHasCondition(mech, 'Destroyed')
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
          live={liveInRead}
          crawler={composition.crawler}
          crawlerReadOnly={crawlerReadOnly}
          linkedUnits={rail}
          pilotAbilities={pilotAbilities}
        />
      )}
    />
  )
}

/**
 * The chassis's Tech Level and the build's Scrap on the band (C2's rank), as
 * a crawler's TL rides its band. The Scrap is the whole mech's, chassis and
 * loadout, by Tech Level (`TL1 18 · TL2 5`, r6 E4): a variant is compared on
 * what it costs, and Scrap of two levels is never one number.
 */
function MechBandRank({ mech }: { mech: Mech }) {
  const chassis = resolveChassisRef(mech.chassisRef)
  if (!chassis) return null
  return (
    <>
      {typeof chassis.techLevel === 'number' && (
        <Stat label={buildSheetCopy('tl')} value={chassis.techLevel} />
      )}
      <Stat label={buildSheetCopy('scrap')} value={scrapSplit(mechScrap(mech))} />
    </>
  )
}
