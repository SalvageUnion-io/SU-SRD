/**
 * PilotLiveSheet — the pilot branch of the live sheet (`Sheet` dispatches to
 * it), in the poster layout.
 *
 * The body owns the identity band (Workshop-Manual layout): `PilotSheet`
 * renders the `SheetHero` band as its first region. This
 * component's remaining job is composing the assigned-mech/home-crawler rail
 * content and handing it to `PilotSheet` as `linkedUnits`.
 */

import { containerOf } from 'game-domain/container'
import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import { pilotingContext } from 'game-domain/rules/pilotingContext'
import type { Pilot } from 'game-domain/schemas/pilot'
import { isPilotDead, pilotMaxAP, pilotMaxHP, resolvePool } from 'salvageunion-reference/rules'
import { Stat } from '../../components/index'
import { runWrite } from '../../lib/runWrite'
import { AssignPicker } from '../wiring/AssignPicker'
import type { AssignedSlot, AssignedUnit } from './AssignedUnits'
import { AssignedUnits } from './AssignedUnits'
import { pilotStamp } from './bandStamps.model'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { PilotSheet } from './PilotSheet'
import { crawlerRailItems, mechRailItems, rowStats } from './railStats.model'
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
  store,
  storeState,
  holds,
  hrefFor,
  withheld,
  patch,
}: PilotLiveSheetProps) {
  // Softlink ids for the rail's Unassign control. Derived from the live link
  // set — composition only exposes
  // resolved entities, not the link records. Link add/remove is available
  // whenever the sheet is in Edit, and needs no confirm: an assignment is
  // reversible bookkeeping (ADR-007).
  // A mech link is undrawn from its mech, so only one this sheet holds offers it
  // — a crewmate's mech flying this pilot is theirs to unassign.
  const mechLinkId = storeState.softLinks.find(
    (l) => l.type === 'mech-to-pilot' && l.to.id === pilot.id && holds('mech', l.from.id)
  )?.id
  const withheldMech = withheld.find((u) => u.kind === 'mech')
  const withheldCrawler = withheld.find((u) => u.kind === 'crawler')
  const crawlerLinkId = storeState.softLinks.find(
    (l) => l.type === 'pilot-to-crawler' && l.from.id === pilot.id
  )?.id
  const unassign = (linkId: string | undefined) =>
    editable && linkId ? () => runWrite(() => storeState.delete('softLink', linkId)) : undefined
  // Both slots pick from where the pilot lives — its Game, or your shelves.
  const self = { type: 'pilot', id: pilot.id } as const
  const container = containerOf(pilot)
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

  // Assigned units: each a contentful Mini with its vitals, the same in Read
  // and Edit; Edit adds Change and Unassign after it, and Assign / + Create for an
  // empty place (the crawler's with the hand-set crawler level until one is).
  const units: AssignedUnit[] = []
  if (composition.mech) {
    units.push({
      key: 'mech',
      kind: 'mech',
      name: composition.mech.name,
      readings: rowStats(
        mechRailItems(composition.mech, pilotingContext(composition.mech, pilot.abilities))
      ),
      href: hrefFor('mech', composition.mech.id),
      change: (
        <AssignPicker
          subject={self}
          container={container}
          pick="mech"
          filled
          exclude={[composition.mech.id]}
        />
      ),
      onUnassign: unassign(mechLinkId),
    })
  } else if (withheldMech) {
    units.push({ key: 'mech', kind: 'mech', name: withheldMech.name ?? 'Not shared' })
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
    ...(composition.mech || withheldMech
      ? []
      : [
          {
            key: 'mech',
            kind: 'mech' as const,
            assign: <AssignPicker subject={self} container={container} pick="mech" size="mini" />,
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
            extra: (
              <Stat
                label="Mock Crawler Level"
                value={pilot.crawlerLevel ?? 1}
                max={6}
                mode="edit"
                onChange={(v) => patch({ crawlerLevel: Math.max(1, v) })}
              />
            ),
          },
        ]),
  ]
  // Nothing linked in Read draws no section (`AssignedUnits`), so none reaches
  // the sidebar either: an empty sidebar would hold its column open.
  const rail =
    editable || units.length > 0 ? (
      <AssignedUnits units={units} slots={slots} editable={editable} />
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
