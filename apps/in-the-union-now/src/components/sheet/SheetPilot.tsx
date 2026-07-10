/**
 * SheetPilot — the pilot branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19; redesigned to the poster layout, Phase 2).
 *
 * The hero now carries ONLY the name row + meta (poster region grid, D7):
 * Identity, Vitals and the linked-unit rail all moved into the body's R1/R3
 * poster regions (see `PilotSheet`) — SheetHero no longer receives
 * `identityBlock`/`trackers`/`inset`/`rail`. This component's remaining job
 * is composing the assigned-mech/home-crawler rail content and handing it to
 * `PilotSheet` as `linkedUnits`.
 */

import { Pill, StatBlock } from 'suref-react'

import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { isPilotDead, pilotMaxAP, pilotMaxHP } from '../../lib/rules/derivedStats'
import type { Pilot } from '../../lib/schemas/pilot'
import { AssignCrawlerToPilot } from '../wiring/AssignCrawlerToPilot'
import { LiveSheet } from './LiveSheet'
import type { LiveSheetStripItem } from './LiveSheet'
import { PilotSheet } from './PilotSheet'
import { QuickRollFab } from './QuickRollFab'
import { SheetHero } from './SheetHero'
import { RailChip, RailEmpty } from './SheetRail'
import { CrawlerRailStats, MechRailStats, RailCta, mechStatusPill } from './SheetRailParts'
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
        <RailChip
          tone="mech"
          roleLabel="Assigned Mech"
          name={composition.mech.name}
          href={`/sheet/mech/${composition.mech.id}`}
          status={mechStatusPill(composition.mech)}
          stats={<MechRailStats mech={composition.mech} />}
          onUnassign={unassign(mechLinkId)}
        />
      ) : (
        <RailEmpty
          tone="mech"
          roleLabel="Assigned Mech"
          message="No mech assigned — build one to track its loadout and heat from here."
          actions={editable ? <RailCta href="/mechs/new" label="+ Create" primary /> : undefined}
        />
      )}
      {composition.crawler ? (
        <RailChip
          tone="crawler"
          roleLabel="Home Crawler"
          name={composition.crawler.name}
          href={`/sheet/crawler/${composition.crawler.id}`}
          tl={parseCrawlerTechLevel(composition.crawler.techLevel)}
          stats={<CrawlerRailStats crawler={composition.crawler} />}
          onUnassign={unassign(crawlerLinkId)}
        />
      ) : (
        <RailEmpty
          tone="crawler"
          roleLabel="Home Crawler"
          message="No crawler linked. Set the crawler level by hand until your union home is wired in."
          mock={
            <StatBlock
              code="CRAWLER"
              name="Level"
              unit="Tech Level"
              max={6}
              value={pilot.crawlerLevel ?? 1}
              onChange={editable ? (v) => patch({ crawlerLevel: Math.max(1, v) }) : undefined}
              editable={editable}
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
      actions={actions}
      fab={editable ? <QuickRollFab /> : undefined}
      renderHero={({ heroRef }) => (
        <SheetHero
          heroRef={heroRef}
          cat="Pilot"
          name={pilot.name}
          meta={dead ? <Pill tone="bad">Dead</Pill> : undefined}
        />
      )}
      renderBody={() => (
        <PilotSheet pilot={pilot} store={store} readOnly={readOnly} linkedUnits={rail} />
      )}
    />
  )
}
