/**
 * SheetPilot — the pilot branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19; redesigned to the poster layout, Phase 2).
 *
 * The body owns the identity band now (Workshop-Manual layout): SheetPilot
 * passes NO `renderHero`, and `PilotSheet` renders the `SheetHero` band as its
 * first region, wrapping it with the `heroRef` from `renderBody`. This
 * component's remaining job is composing the assigned-mech/home-crawler rail
 * content and handing it to `PilotSheet` as `linkedUnits`.
 */

import { EntityRow, Stat } from 'component-lib'

import { isPilotDead, pilotMaxAP, pilotMaxHP } from '../../lib/rules/derivedStats'
import type { Pilot } from '../../lib/schemas/pilot'
import { AssignCrawlerToPilot } from '../wiring/AssignCrawlerToPilot'
import { LiveSheet } from './LiveSheet'
import type { LiveSheetStripItem } from './LiveSheet'
import { DashboardChooser } from '../dashboard/DashboardChooser'
import { PilotSheet } from './PilotSheet'
import { RailCta } from './SheetRailParts'
import { AppLink } from '../shared/AppLink'
import { crawlerRailItems, mechRailItems, mechStatusPill, rowStats } from './railStats'
import type { SheetViewCommonProps } from './sheetViewProps'

type SheetPilotProps = SheetViewCommonProps & { pilot: Pilot }

export function SheetPilot({
  pilot,
  composition,
  back,
  actions,
  segments,
  editable,
  readOnly,
  store,
  storeState,
  patch,
}: SheetPilotProps) {
  // Softlink ids for the rail's Unassign control (relocated from the removed
  // detail page). Derived from the live link set — composition only exposes
  // resolved entities, not the link records. Per the unified edit language,
  // link add/remove is always available on editable sheets (no edit mode).
  const mechLinkId = storeState.softLinks.find(
    (l) => l.type === 'mech-to-pilot' && l.to.id === pilot.id
  )?.id
  const crawlerLinkId = storeState.softLinks.find(
    (l) => l.type === 'pilot-to-crawler' && l.from.id === pilot.id
  )?.id
  const unassign = (linkId: string | undefined) =>
    editable && linkId ? () => void storeState.delete('softLink', linkId) : undefined
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  const hp = Math.min(pilot.currentHP ?? maxHP, maxHP)
  const ap = Math.min(pilot.currentAP ?? maxAP, maxAP)

  const strip: LiveSheetStripItem[] = [
    { key: 'hp', label: 'HP', stat: 'hp', value: hp, max: maxHP },
    { key: 'ap', label: 'AP', stat: 'ap', value: ap, max: maxAP },
  ]

  const dead = isPilotDead(pilot)

  // Linked Units rail content (poster R3, span 5) — built here because it
  // needs `composition` (resolved mech/crawler), which PilotSheet does not
  // receive; handed down as `linkedUnits`.
  const rail = (
    <>
      {composition.mech ? (
        <EntityRow
          entityType="mech"
          className="flex-[1_1_0%]"
          name={composition.mech.name}
          sheetHref={`/sheet/mech/${composition.mech.id}`}
          linkAs={AppLink}
          meta="Assigned Mech"
          metaLine={mechStatusPill(composition.mech).label}
          stats={rowStats(mechRailItems(composition.mech))}
          onDeleteClick={unassign(mechLinkId)}
        />
      ) : (
        <EntityRow
          empty
          entityType="mech"
          className="flex-[1_1_0%]"
          roleLabel="Assigned Mech"
          message="No mech assigned — build one to track its loadout and heat from here."
          actions={editable ? <RailCta href="/mechs/new" label="+ Create" primary /> : undefined}
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
          onDeleteClick={unassign(crawlerLinkId)}
        />
      ) : (
        <EntityRow
          empty
          entityType="crawler"
          className="flex-[1_1_0%]"
          roleLabel="Home Crawler"
          message="No crawler linked. Set the crawler level by hand until your union home is wired in."
          mock={
            <Stat
              label="CRAWLER"
              value={pilot.crawlerLevel ?? 1}
              max={6}
              mode={editable ? 'edit' : 'read'}
              onChange={(v) => patch({ crawlerLevel: Math.max(1, v) })}
            />
          }
          actions={
            editable ? (
              <>
                <RailCta href="/crawlers/new" label="+ Create" primary />
                <AssignCrawlerToPilot pilotId={pilot.id} />
              </>
            ) : undefined
          }
        />
      )}
    </>
  )

  return (
    <LiveSheet
      variant="pilot"
      name={pilot.name}
      strip={strip}
      back={back}
      pill={dead ? { label: 'Dead', tone: 'bad' } : { label: 'Pilot', tone: 'pilot' }}
      segments={segments}
      actions={
        editable ? (
          <>
            <DashboardChooser
              initialPilotId={pilot.id}
              initialMechId={composition.mech?.id}
              initialCrawlerId={composition.crawler?.id}
              activeWorkspaceId={pilot.workspaceId}
            />
            {actions}
          </>
        ) : (
          actions
        )
      }
      renderBody={({ heroRef }) => (
        <PilotSheet
          pilot={pilot}
          store={store}
          readOnly={readOnly}
          heroRef={heroRef}
          linkedUnits={rail}
        />
      )}
    />
  )
}
