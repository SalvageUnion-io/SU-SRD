/**
 * SheetPilotView — the pilot branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19). Hero = identity + HP/AP/TP trackers +
 * conditions; rail = assigned mech + home crawler; body = PilotSheet.
 */

import { MChip, Pill, StatBlock } from 'suref-react'

import { resolveClassName } from '../../lib/classRef'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { isPilotDead, pilotMaxAP, pilotMaxHP } from '../../lib/rules/derivedStats'
import type { Pilot } from '../../lib/schemas/pilot'
import { AssignCrawlerToPilot } from '../wiring/AssignCrawlerToPilot'
import { ConditionsEditor } from './ConditionsEditor'
import { LiveSheet } from './LiveSheet'
import type { LiveSheetStripItem } from './LiveSheet'
import { PilotIdentityLines } from './PilotIdentity'
import type { UsedToggleKey } from './PilotIdentity'
import { PilotSheet } from './PilotSheet'
import { QuickRollFab } from './QuickRollFab'
import { SheetHero } from './SheetHero'
import { RailChip, RailEmpty } from './SheetRail'
import { CrawlerRailStats, MechRailStats, RailCta, mechStatusPill } from './SheetRailParts'
import type { SheetViewCommonProps } from './sheetViewProps'

type SheetPilotViewProps = SheetViewCommonProps & { pilot: Pilot }

export function SheetPilotView({
  pilot,
  composition,
  wired,
  back,
  actions,
  segments,
  editable,
  readOnly,
  store,
  storeState,
  patch,
}: SheetPilotViewProps) {
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  const hp = Math.min(pilot.currentHP ?? maxHP, maxHP)
  const ap = Math.min(pilot.currentAP ?? maxAP, maxAP)
  const tp = pilot.trainingPoints ?? 0

  const strip: LiveSheetStripItem[] = [
    { key: 'hp', label: 'HP', stat: 'hp', value: hp, max: maxHP },
    { key: 'ap', label: 'AP', stat: 'ap', value: ap, max: maxAP },
  ]

  const dead = isPilotDead(pilot)

  /** Toggle one of the once-per-Downtime used flags (rules A8–A10). */
  function toggleUsed(key: UsedToggleKey, next: boolean) {
    // Read the freshest flags from the store (not the render-time prop) so
    // rapid toggles on sibling lines don't stomp each other.
    const fresh = storeState.get('pilot', pilot.id)
    const prev = fresh?.usedToggles ?? pilot.usedToggles ?? {}
    void storeState.update('pilot', pilot.id, {
      usedToggles: { ...prev, [key]: next },
    })
  }

  /** Persist the full conditions list (flat string set, no partial merge). */
  function handleConditionsChange(next: string[]) {
    void storeState.update('pilot', pilot.id, { conditions: next })
  }

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
      wired={wired}
      rail={rail}
      segments={segments}
      actions={actions}
      fab={editable ? <QuickRollFab /> : undefined}
      renderHero={({ heroRef, rail: heroRail }) => (
        <SheetHero
          heroRef={heroRef}
          cat="Pilot"
          name={pilot.name}
          meta={
            <>
              <MChip label="Callsign" value={`“${pilot.callsign}”`} variant="call" />
              <MChip label="Class" value={resolveClassName(pilot.classRef)} variant="class" />
              {dead && <Pill tone="bad">Dead</Pill>}
            </>
          }
          specs={
            <PilotIdentityLines pilot={pilot} onToggleUsed={editable ? toggleUsed : undefined} />
          }
          trackers={
            <>
              <StatBlock
                code="HP"
                name="Hit Points"
                unit="Points"
                stat="hp"
                max={maxHP}
                value={hp}
                onChange={editable ? (v) => patch({ currentHP: v }) : undefined}
                editable={editable}
              />
              <StatBlock
                code="AP"
                name="Ability Points"
                unit="Points"
                stat="ap"
                max={maxAP}
                value={ap}
                onChange={editable ? (v) => patch({ currentAP: v }) : undefined}
                editable={editable}
              />
              <StatBlock
                code="TP"
                name="Training"
                unit="Points"
                value={tp}
                onChange={editable ? (v) => patch({ trainingPoints: v }) : undefined}
                editable={editable}
              />
            </>
          }
          inset={
            <div className="w-full sm:max-w-[360px]">
              <span className="mb-1 block text-right font-cond text-label font-bold uppercase leading-none tracking-caps text-ink">
                Conditions
              </span>
              <ConditionsEditor
                conditions={pilot.conditions}
                onChange={handleConditionsChange}
                readOnly={readOnly}
              />
            </div>
          }
          rail={heroRail}
        />
      )}
      renderBody={() => <PilotSheet pilot={pilot} store={store} readOnly={readOnly} />}
    />
  )
}
