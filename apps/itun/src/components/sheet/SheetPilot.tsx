/**
 * SheetPilot — the pilot branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19; redesigned to the poster layout, Phase 2).
 *
 * The body owns the identity band (Workshop-Manual layout): `PilotSheet`
 * renders the `SheetHero` band as its first region. This
 * component's remaining job is composing the assigned-mech/home-crawler rail
 * content and handing it to `PilotSheet` as `linkedUnits`.
 */

import { Stat } from 'component-lib'
import { pilotMaxAP, pilotMaxHP, resolvePool } from 'salvageunion-reference/rules'
import { containerOf } from '../../lib/container'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { pilotingContext } from '../../lib/rules/pilotingContext'
import { runWrite } from '../../lib/runWrite'
import type { Pilot } from '../../lib/schemas/pilot'
import { AppLink } from '../shared/AppLink'
import { EntityRow } from '../shared/EntityRow'
import { AssignPicker } from '../wiring/AssignPicker'
import { pilotStamp } from './bandStamps'
import { LinkedUnitLink } from './LinkedUnitLink'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { PilotSheet } from './PilotSheet'
import { crawlerRailItems, mechRailItems, mechStatusPill, rowStats } from './railStats'
import { RailCta, WithheldUnitRow } from './SheetRailParts'
import type { SheetViewCommonProps } from './sheetViewProps'

type SheetPilotProps = SheetViewCommonProps & { pilot: Pilot }

export function SheetPilot({
  pilot,
  composition,
  back,
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
}: SheetPilotProps) {
  // Softlink ids for the rail's Unassign control (relocated from the removed
  // detail page). Derived from the live link set — composition only exposes
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
    { key: 'hp', label: 'HP', stat: 'hp', value: hp, max: maxHP },
    { key: 'ap', label: 'AP', stat: 'ap', value: ap, max: maxAP },
  ]

  // Read (board 10): each linked unit is one line, and an empty slot is left
  // out, as an empty field is. With nothing linked, there is no section.
  const readRail = [
    composition.mech ? (
      <LinkedUnitLink
        key="mech"
        kind="mech"
        name={composition.mech.name}
        href={hrefFor('mech', composition.mech.id)}
        stats={rowStats(
          mechRailItems(composition.mech, pilotingContext(composition.mech, pilot.abilities))
        )}
      />
    ) : withheldMech ? (
      <WithheldUnitRow key="mech" unit={withheldMech} label="Assigned Mech" />
    ) : null,
    composition.crawler ? (
      <LinkedUnitLink
        key="crawler"
        kind="crawler"
        name={composition.crawler.name}
        href={hrefFor('crawler', composition.crawler.id)}
        stats={rowStats(crawlerRailItems(composition.crawler))}
      />
    ) : withheldCrawler ? (
      <WithheldUnitRow key="crawler" unit={withheldCrawler} label="Home Crawler" />
    ) : null,
  ].filter((unit) => unit !== null)

  // Linked Units rail content (poster R3, span 5) — built here because it
  // needs `composition` (resolved mech/crawler), which PilotSheet does not
  // receive; handed down as `linkedUnits`.
  const rail = !editable ? (
    readRail.length > 0 ? (
      readRail
    ) : null
  ) : (
    <>
      {composition.mech ? (
        <EntityRow
          entityType="mech"
          className="flex-[1_1_0%]"
          name={composition.mech.name}
          sheetHref={hrefFor('mech', composition.mech.id)}
          linkAs={AppLink}
          meta="Assigned Mech"
          metaLine={mechStatusPill(composition.mech).label}
          stats={rowStats(
            mechRailItems(composition.mech, pilotingContext(composition.mech, pilot.abilities))
          )}
          actions={
            editable ? (
              <AssignPicker
                subject={self}
                container={container}
                pick="mech"
                filled
                exclude={[composition.mech.id]}
                size="mini"
              />
            ) : undefined
          }
          onUnassignClick={unassign(mechLinkId)}
        />
      ) : withheldMech ? (
        <WithheldUnitRow unit={withheldMech} label="Assigned Mech" />
      ) : (
        <EntityRow
          empty
          entityType="mech"
          className="flex-[1_1_0%]"
          roleLabel="Assigned Mech"
          message="No mech assigned — assign one of yours, or build one to track its loadout and heat from here."
          actions={
            editable ? (
              <>
                <RailCta href="/mechs/new" label="+ Create" primary />
                <AssignPicker subject={self} container={container} pick="mech" />
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
      variant="pilot"
      name={pilot.name}
      strip={strip}
      back={back}
      segments={segments}
      band={band}
      kindDetail={pilotStamp(pilot.classRef)}
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
