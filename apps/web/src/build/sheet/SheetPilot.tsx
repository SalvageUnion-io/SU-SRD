/**
 * SheetPilot — the pilot branch of the live sheet (extracted from
 * Sheet.tsx), in the poster layout.
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
import { pilotMaxAP, pilotMaxHP, resolvePool } from 'salvageunion-reference/rules'
import { runWrite } from '../../lib/runWrite'
import { Stat } from '../../components/index'
import { EmptyUnitSlot } from '../../components/shared/EmptyUnitSlot'
import { UnitRow } from '../../components/shared/UnitRow'
import { AssignPicker } from '../wiring/AssignPicker'
import { pilotStamp } from './bandStamps.model'
import { LinkedUnitLink } from './LinkedUnitLink'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { PilotSheet } from './PilotSheet'
import { crawlerRailItems, mechRailItems, mechStatusPill, rowStats } from './railStats.model'
import { RailCta, WithheldUnitRow } from './SheetRailParts'
import type { SheetViewCommonProps } from './sheetViewProps.model'

type SheetPilotProps = SheetViewCommonProps & { pilot: Pilot }

export function SheetPilot({
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

  // Assigned Units rail content (poster R3, span 5) — built here because it
  // needs `composition` (resolved mech/crawler), which PilotSheet does not
  // receive; handed down as `linkedUnits`.
  const rail = !editable ? (
    readRail.length > 0 ? (
      readRail
    ) : null
  ) : (
    <>
      {composition.mech ? (
        <div className="su-sheet-pilot-fill">
          <UnitRow
            kind="mech"
            name={composition.mech.name}
            note="Assigned Mech"
            readings={[
              ...rowStats(
                mechRailItems(composition.mech, pilotingContext(composition.mech, pilot.abilities))
              ),
              { label: 'Condition', value: mechStatusPill(composition.mech).label },
            ]}
            href={hrefFor('mech', composition.mech.id)}
            controls={
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
            onUnassign={unassign(mechLinkId)}
          />
        </div>
      ) : withheldMech ? (
        <WithheldUnitRow unit={withheldMech} label="Assigned Mech" />
      ) : (
        <EmptyUnitSlot
          className="su-sheet-pilot-fill"
          roleLabel="Assigned Mech"
          message="No mech assigned — assign one of yours, or build one to track its loadout and heat from here."
          actions={
            editable ? (
              <>
                <RailCta href="/mechs/new" primary />
                <AssignPicker subject={self} container={container} pick="mech" />
              </>
            ) : undefined
          }
        />
      )}
      {composition.crawler ? (
        <div className="su-sheet-pilot-fill">
          <UnitRow
            kind="crawler"
            name={composition.crawler.name}
            note="Home Crawler"
            readings={rowStats(crawlerRailItems(composition.crawler))}
            href={hrefFor('crawler', composition.crawler.id)}
            controls={
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
            onUnassign={unassign(crawlerLinkId)}
          />
        </div>
      ) : withheldCrawler ? (
        <WithheldUnitRow unit={withheldCrawler} label="Home Crawler" />
      ) : (
        <EmptyUnitSlot
          className="su-sheet-pilot-fill"
          roleLabel="Home Crawler"
          message="No crawler assigned. Set the crawler level by hand until your union home is assigned."
          mock={
            <Stat
              orientation="horizontal"
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
                <RailCta href="/crawlers/new" primary />
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
