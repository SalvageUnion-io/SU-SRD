/**
 * PilotLiveSheet — the pilot branch of the live sheet (`Sheet` dispatches to
 * it), in the poster layout.
 *
 * The body owns the identity band (Workshop-Manual layout): `PilotSheet`
 * renders the `SheetHero` band as its first region. This
 * component's remaining job is the condensed strip and the Assigned units
 * (`assignedUnitsFor`), handed to `PilotSheet` as `linkedUnits`.
 */

import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import type { Pilot } from 'game-domain/schemas/pilot'
import { isPilotDead, pilotMaxAP, pilotMaxHP, resolvePool } from 'salvageunion-reference/rules'
import { Stat } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import { assignedRail } from './assignedRail'
import { pilotStamp } from './bandStamps.model'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { PilotSheet } from './PilotSheet'
import type { SheetViewCommonProps } from './sheetViewProps.model'

type PilotLiveSheetProps = SheetViewCommonProps & { pilot: Pilot }

export function PilotLiveSheet({
  pilot,
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
  patch,
}: PilotLiveSheetProps) {
  // Stat Training follows the pilot's crawler tier (linked crawler, else the
  // manual `crawlerLevel`) — the same level the body sheet derives from.
  const statInput = {
    ...pilot,
    crawlerTechLevel: resolveEffectiveCrawlerLevel(pilot, composition.crawler),
  }
  const maxHP = Math.max(0, pilotMaxHP(statInput))
  const maxAP = Math.max(0, pilotMaxAP(statInput))
  const hp = resolvePool(pilot.currentHP, maxHP)
  const ap = resolvePool(pilot.currentAP, maxAP)

  const strip: LiveSheetStripItem[] = [
    { key: 'hp', label: buildSheetCopy('hp'), value: hp, max: maxHP },
    { key: 'ap', label: buildSheetCopy('ap'), value: ap, max: maxAP },
  ]

  // Assigned units: the mech it flies and the crawler it crews; an empty
  // crawler place stands in the hand-set crawler level until one is assigned.
  const rail = assignedRail(
    { kind: 'pilot', entity: pilot },
    { composition, withheld, storeState, holds, hrefFor, ownerOf, editable },
    {
      crawler: (
        <Stat
          label={buildSheetCopy('mockCrawlerLevel')}
          value={pilot.crawlerLevel ?? 1}
          max={6}
          mode="edit"
          onChange={(v) => patch({ crawlerLevel: Math.max(1, v) })}
        />
      ),
    }
  )

  return (
    <LiveSheet
      variant="pilot"
      name={pilot.name}
      strip={strip}
      segments={segments}
      band={band}
      source={pilot.seedRef ? 'starter' : undefined}
      kindDetail={pilotStamp(pilot.classRef)}
      out={
        isPilotDead(statInput)
          ? {
              stamp: 'Killed in Action',
              note: buildSheetCopy('injuriesHaveReducedThisPilots'),
            }
          : undefined
      }
      actions={actions}
      renderBody={() => (
        <PilotSheet
          pilot={pilot}
          store={store}
          readOnly={readOnly}
          crawlerReadOnly={crawlerReadOnly}
          linkedUnits={rail}
        />
      )}
    />
  )
}
