/**
 * PilotLiveSheet — the pilot branch of the live sheet (`Sheet` dispatches to
 * it), in the poster layout.
 *
 * The body owns the identity band (Workshop-Manual layout): `PilotSheet`
 * renders the `SheetHero` band as its first region. This
 * component's remaining job is the condensed strip and the Assigned units
 * (`assignedUnitsFor`), handed to `PilotSheet` as `linkedUnits`.
 */

import { containerOf } from 'game-domain/container'
import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import type { Pilot } from 'game-domain/schemas/pilot'
import { isPilotDead, pilotMaxAP, pilotMaxHP, resolvePool } from 'salvageunion-reference/rules'
import { Stat } from '../../components/index'
import { runWrite } from '../../lib/runWrite'
import { AssignPicker } from '../wiring/AssignPicker'
import { AssignedUnits } from './AssignedUnits'
import { assignedUnitsFor, hasAssignedUnits } from './assignedUnits.model'
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
    { key: 'hp', label: 'HP', value: hp, max: maxHP },
    { key: 'ap', label: 'AP', value: ap, max: maxAP },
  ]

  // Assigned units: the mech it flies and the crawler it crews; an empty
  // crawler place stands in the hand-set crawler level until one is assigned.
  const self = { type: 'pilot', id: pilot.id } as const
  const container = containerOf(pilot)
  const assigned = assignedUnitsFor({
    subject: { kind: 'pilot', entity: pilot },
    composition,
    withheld,
    softLinks: storeState.softLinks,
    holds,
    hrefFor,
    ownerOf,
    editable,
    unassign: (linkId) => runWrite(() => storeState.delete('softLink', linkId)),
    picker: (pick, options) => (
      <AssignPicker subject={self} container={container} pick={pick} {...options} />
    ),
    extra: {
      crawler: (
        <Stat
          label="Mock Crawler Level"
          value={pilot.crawlerLevel ?? 1}
          max={6}
          mode="edit"
          onChange={(v) => patch({ crawlerLevel: Math.max(1, v) })}
        />
      ),
    },
  })
  // Nothing linked in Read draws no section, so none reaches the sidebar
  // either: an empty sidebar would hold its column open.
  const rail = hasAssignedUnits(assigned.units, editable) ? (
    <AssignedUnits {...assigned} editable={editable} />
  ) : undefined

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
              note: 'Injuries have reduced this Pilot’s maximum HP to 0. Remove an injury if this was a bookkeeping error.',
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
