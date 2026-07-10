/**
 * SheetCrawler — the crawler branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19; redesigned to the poster layout, phase 3).
 * Hero top region = IDENTITY block (Name/Type fields + ability/type entity
 * cards + description, with the section's own Edit button — see
 * CrawlerIdentity.tsx) vs the ECONOMY rail (SP/Bays trackers + the
 * UPKEEP/UPGRADE/TRADE lozenges, the R-4 action entry points) on the right;
 * rail = docked mech + lead pilot; body = CrawlerSheet. Owns the
 * economy-dialog state (it was hoisted to Sheet only because the branch
 * wasn't a component).
 */

import { useState } from 'react'
import { MChip, StatBlock } from 'suref-react'

import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { bayGate, tradingSourceTl } from '../../lib/rules/crawlerEconomy'
import { crawlerMaxSP } from '../../lib/rules/derivedStats'
import type { Crawler } from '../../lib/schemas/crawler'
import { CrawlerEconomyControl } from './CrawlerEconomyControl'
import type { CrawlerEconomyDialog } from './CrawlerEconomyControl'
import { CrawlerIdentityPanel } from './CrawlerIdentity'
import { CrawlerSheet } from './CrawlerSheet'
import { LiveSheet } from './LiveSheet'
import type { LiveSheetStripItem } from './LiveSheet'
import { QuickRollFab } from './QuickRollFab'
import { ChassisStats, SheetHero } from './SheetHero'
import type { ChassisStatItem } from './SheetHero'
import { RailChip, RailEmpty } from './SheetRail'
import { MechRailStats, PilotRailStats, RailCta, bayStates, mechStatusPill } from './SheetRailParts'
import type { SheetViewCommonProps } from './sheetViewProps'

type SheetCrawlerProps = SheetViewCommonProps & { crawler: Crawler }

export function SheetCrawler({
  crawler,
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
}: SheetCrawlerProps) {
  // Crawler-economy dialog behind the UPKEEP/UPGRADE/TRADE lozenges (R-4).
  const [econDialog, setEconDialog] = useState<CrawlerEconomyDialog | null>(null)

  const maxSP = crawlerMaxSP(crawler)
  const sp = Math.min(crawler.currentSP ?? maxSP, maxSP)
  const states = bayStates(crawler)
  const intactBays = states.filter((s) => s === 'intact').length
  const tl = parseCrawlerTechLevel(crawler.techLevel)

  const strip: LiveSheetStripItem[] = [
    { key: 'sp', label: 'SP', stat: 'sp', value: sp, max: maxSP },
    ...(states.length > 0
      ? [
          {
            key: 'bays',
            label: 'Bays',
            stat: 'cw' as const,
            value: intactBays,
            max: states.length,
          },
        ]
      : []),
  ]

  // UPKEEP / UPGRADE-pool / TRADE / CREW spec lozenges (design §4.4): upkeep
  // is 5 Scrap of crawler TL per Downtime (rules C3); the Upgrade Pool fills
  // toward 30× TL (rules C4); the Trading Bay sources TL+1 wares (p.223);
  // crew leads = one per installed bay (rules C11). On editable sheets the
  // economy lozenges are the R-4 action entry points (CrawlerEconomyControl).
  const trading = bayGate(crawler, 'Trading Bay')
  const crawlerSpecs: ChassisStatItem[] = [
    ...(tl !== undefined
      ? [
          {
            code: 'UPKEEP',
            name: 'Scrap/wk',
            unit: `Tech ${tl}`,
            value: 5,
            pips: false,
            onClick: editable ? () => setEconDialog('upkeep') : undefined,
            actionLabel: 'Pay Upkeep',
          },
        ]
      : []),
    {
      code: 'UPGRADE',
      name: 'Pool',
      value: crawler.upgradePool ?? 0,
      max: 30,
      pips: false,
      onClick: editable ? () => setEconDialog('upgrade') : undefined,
      actionLabel: 'Upgrade Crawler',
    },
    ...(trading.present && tl !== undefined
      ? [
          {
            code: 'TRADE',
            name: 'Wares',
            unit: `Tech ${tradingSourceTl(tl)}`,
            value: tradingSourceTl(tl),
            pips: false,
            onClick: editable ? () => setEconDialog('trade') : undefined,
            actionLabel: 'Open the Trading Bay',
          },
        ]
      : []),
    ...(states.length > 0
      ? [{ code: 'CREW', name: 'Leads', value: states.length, pips: false }]
      : []),
  ]

  /** Bays are Intact/Damaged ONLY (rules C8) — clicking a pip toggles. */
  function toggleBay(index: number) {
    const bay = (crawler.crawlerBays ?? [])[index]
    if (!bay || typeof storeState.updateCrawlerBay !== 'function') return
    const next = (bay.condition ?? 'intact') === 'intact' ? 'damaged' : 'intact'
    void storeState.updateCrawlerBay(crawler.id, bay.bayRef, { condition: next }, index)
  }

  // Unassign for the lead pilot's direct link (pilot-to-crawler) — always
  // available on editable sheets per the unified edit language (no edit
  // mode). The docked-mech chip is transitive (the lead pilot's mech) so
  // it's nav-only.
  const leadPilotLinkId = storeState.softLinks.find(
    (l) =>
      l.type === 'pilot-to-crawler' && l.to.id === crawler.id && l.from.id === composition.pilot?.id
  )?.id
  const unassignLeadPilot =
    editable && leadPilotLinkId
      ? () => void storeState.delete('softLink', leadPilotLinkId)
      : undefined

  const rail = (
    <>
      {composition.mech ? (
        <RailChip
          tone="mech"
          roleLabel="Docked Mech"
          name={composition.mech.name}
          href={`/sheet/mech/${composition.mech.id}`}
          status={mechStatusPill(composition.mech)}
          stats={<MechRailStats mech={composition.mech} />}
        />
      ) : (
        <RailEmpty
          tone="mech"
          roleLabel="Docked Mech"
          message="No mech in the bay — dock one to repair, re-arm and track it from here."
          actions={editable ? <RailCta href="/mechs/new" label="+ Create" primary /> : undefined}
        />
      )}
      {composition.pilot ? (
        <RailChip
          tone="pilot"
          roleLabel="Lead Pilot"
          name={composition.pilot.name}
          href={`/sheet/pilot/${composition.pilot.id}`}
          status={{ label: 'Active', tone: 'pilot' }}
          stats={<PilotRailStats pilot={composition.pilot} />}
          onUnassign={unassignLeadPilot}
        />
      ) : (
        <RailEmpty
          tone="pilot"
          roleLabel="Lead Pilot"
          message="No lead pilot set. Assign a crew member to speak for the crawler."
          actions={editable ? <RailCta href="/pilots/new" label="+ Create" primary /> : undefined}
        />
      )}
    </>
  )

  return (
    <>
      <LiveSheet
        variant="crawler"
        name={crawler.name}
        strip={strip}
        back={back}
        pill={{ label: 'Crawler', tone: 'crawler' }}
        wired={wired}
        rail={rail}
        segments={segments}
        actions={actions}
        fab={editable ? <QuickRollFab /> : undefined}
        renderHero={({ heroRef, rail: heroRail }) => (
          <SheetHero
            heroRef={heroRef}
            cat="Crawler"
            name={crawler.name}
            meta={tl !== undefined ? <MChip label="Tech LV" value={tl} /> : undefined}
            identityBlock={
              // Poster region 1 (left): Name/Type fields, ability + type
              // entity cards, and the description panel (FIELD section with
              // its own Edit button).
              <CrawlerIdentityPanel
                crawler={crawler}
                store={store}
                storeState={storeState}
                patch={editable ? patch : undefined}
                readOnly={readOnly}
              />
            }
            trackers={
              <>
                <StatBlock
                  code="Structure"
                  name="Points"
                  unit="Points"
                  stat="sp"
                  max={maxSP}
                  value={sp}
                  onChange={editable ? (v) => patch({ currentSP: v }) : undefined}
                  editable={editable}
                />
                {states.length > 0 && (
                  <StatBlock
                    code="Bays"
                    name="Condition"
                    unit="Bays"
                    states={states}
                    onBay={editable ? toggleBay : undefined}
                  />
                )}
              </>
            }
            vitals={
              // Poster region 2 (right, under the SP gauge): the economy
              // lozenges — the R-4 crawler-economy action entry points.
              crawlerSpecs.length > 0 ? <ChassisStats items={crawlerSpecs} /> : undefined
            }
            rail={heroRail}
          />
        )}
        renderBody={() => (
          <CrawlerSheet
            crawler={crawler}
            mech={composition.mech}
            store={store}
            readOnly={readOnly}
          />
        )}
      />
      {editable && (
        <CrawlerEconomyControl
          crawler={crawler}
          store={store}
          open={econDialog}
          onClose={() => setEconDialog(null)}
        />
      )}
    </>
  )
}
