/**
 * SheetCrawler — the crawler branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19; redesigned to the poster layout, Phase 2).
 *
 * The hero now carries ONLY the name row + meta (poster region grid, D7):
 * Identity, the economy readouts and the linked-unit rail all moved into the
 * body's poster regions (see `CrawlerSheet`) — SheetHero no longer receives
 * `identityBlock`/`trackers`/`vitals`/`rail`, mirroring SheetPilot/SheetMech.
 * This component's remaining job is composing the economy band (the poster
 * `.econ` frame — `CrawlerEconFrame` — wrapping the SP `VitalGauge` + the
 * Tech-LVL/Upkeep/Upgrade/Trade/Crew lozenges, the R-4 action entry points)
 * and the docked-mech/lead-pilot rail content, and handing both to
 * `CrawlerSheet` as `economy` / `linkedUnits`. Owns the economy-dialog state
 * (it was hoisted to Sheet only because the branch wasn't a component).
 */

import { useState } from 'react'
import { EntityRow, Stat, VitalGauge, StatLine } from 'component-lib'

import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { bayGate, tradingSourceTl } from '../../lib/rules/crawlerEconomy'
import { crawlerMaxSP } from '../../lib/rules/derivedStats'
import type { Crawler } from '../../lib/schemas/crawler'
import { CrawlerEconFrame } from 'component-lib'
import type { EconLozItem } from 'component-lib'
import { CrawlerEconomyControl } from './CrawlerEconomyControl'
import type { CrawlerEconomyDialog } from './CrawlerEconomyControl'
import { CrawlerSheet } from './CrawlerSheet'
import { LiveSheet } from './LiveSheet'
import type { LiveSheetStripItem } from './LiveSheet'
import { SheetHero } from 'component-lib'
import { RailChip } from './SheetRail'
import { RailCta } from './SheetRailParts'
import { bayStates, mechRailItems, mechStatusPill, pilotRailItems } from './railStats'
import type { SheetViewCommonProps } from './sheetViewProps'

type SheetCrawlerProps = SheetViewCommonProps & { crawler: Crawler }

export function SheetCrawler({
  crawler,
  composition,
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
  // Cap override (ADR-022, Free Edit): pin Max SP via a signed maxSpModifier
  // delta; the gauge shows "overridden from N" + a revert. Tagged `override`.
  const derivedMaxSP = maxSP - (crawler.maxSpModifier ?? 0)
  const overrideCrawlerMax = (fields: Partial<Crawler>) => {
    void storeState.update('crawler', crawler.id, fields, { kind: 'override' })
  }
  const modOrUndef = (next: number, derived: number): number | undefined => {
    const mod = next - derived
    return mod === 0 ? undefined : mod
  }
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

  // Tech LVL / UPKEEP / UPGRADE-pool / TRADE / CREW lozenges (design §4.4,
  // poster `.lozrow`): upkeep is 5 Scrap of crawler TL per Downtime (rules
  // C3); the Upgrade Pool fills toward 30× TL (rules C4); the Trading Bay
  // sources TL+1 wares (p.223); crew leads = one per installed bay (rules
  // C11). On editable sheets the actionable lozenges (Upkeep/Upgrade/Trade)
  // are the R-4 action entry points (CrawlerEconomyControl); Tech LVL and
  // Crew are read-only readouts.
  const trading = bayGate(crawler, 'Trading Bay')
  const econItems: EconLozItem[] = [
    ...(tl !== undefined ? [{ label: 'Tech LVL', value: tl, caption: 'Crawler' }] : []),
    ...(tl !== undefined
      ? [
          {
            label: 'Upkeep',
            value: 5,
            caption: `Scrap · Tech ${tl}+`,
            action: editable
              ? {
                  label: 'Pay',
                  ariaLabel: 'Pay Upkeep',
                  onClick: () => setEconDialog('upkeep'),
                }
              : undefined,
          },
        ]
      : []),
    {
      label: 'Upgrade',
      value: crawler.upgradePool ?? 0,
      max: 30,
      caption: 'Pool',
      action: editable
        ? {
            label: 'Fund',
            ariaLabel: 'Upgrade Crawler',
            onClick: () => setEconDialog('upgrade'),
          }
        : undefined,
    },
    ...(trading.present && tl !== undefined
      ? [
          {
            label: 'Trade',
            value: tradingSourceTl(tl),
            caption: 'Wares',
            action: editable
              ? {
                  label: 'Trade',
                  ariaLabel: 'Open the Trading Bay',
                  onClick: () => setEconDialog('trade'),
                }
              : undefined,
          },
        ]
      : []),
    ...(states.length > 0 ? [{ label: 'Crew', value: states.length, caption: 'Leads' }] : []),
  ]

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
          stats={<StatLine items={mechRailItems(composition.mech)} />}
        />
      ) : (
        <EntityRow
          empty
          entityType="mech"
          className="flex-[1_1_0%]"
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
          stats={<StatLine items={pilotRailItems(composition.pilot)} />}
          onUnassign={unassignLeadPilot}
        />
      ) : (
        <EntityRow
          empty
          entityType="pilot"
          className="flex-[1_1_0%]"
          roleLabel="Lead Pilot"
          message="No lead pilot set. Assign a crew member to speak for the crawler."
          actions={editable ? <RailCta href="/pilots/new" label="+ Create" primary /> : undefined}
        />
      )}
    </>
  )

  // Economy band (poster `.econ`: SP `VitalGauge` over the Tech-LVL/Upkeep/
  // Upgrade/Trade/Crew lozenges) — built here because it needs `patch` +
  // the econDialog state, which CrawlerSheet does not own; handed down as
  // `economy` and rendered inside the body's Identity card.
  const economy = (
    <CrawlerEconFrame
      gauge={
        <VitalGauge
          label="SP"
          subLabel="Structure"
          value={sp}
          max={maxSP}
          onChange={editable ? (v) => patch({ currentSP: v }) : undefined}
          onMaxChange={
            editable
              ? (next) => overrideCrawlerMax({ maxSpModifier: modOrUndef(next, derivedMaxSP) })
              : undefined
          }
          overriddenFrom={editable ? derivedMaxSP : undefined}
          onRevertOverride={
            editable ? () => overrideCrawlerMax({ maxSpModifier: undefined }) : undefined
          }
          readOnly={!editable}
        />
      }
      items={econItems}
    />
  )

  return (
    <>
      <LiveSheet
        variant="crawler"
        name={crawler.name}
        strip={strip}
        back={back}
        pill={{ label: 'Crawler', tone: 'crawler' }}
        segments={segments}
        actions={actions}
        renderHero={({ heroRef }) => (
          <SheetHero
            heroRef={heroRef}
            cat="Crawler"
            name={crawler.name}
            meta={
              tl !== undefined ? (
                <Stat orientation="horizontal" label="Tech LV" value={tl} />
              ) : undefined
            }
          />
        )}
        renderBody={() => (
          <CrawlerSheet
            crawler={crawler}
            mech={composition.mech}
            store={store}
            readOnly={readOnly}
            economy={economy}
            linkedUnits={rail}
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
