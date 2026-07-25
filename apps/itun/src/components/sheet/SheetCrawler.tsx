/**
 * SheetCrawler — the crawler branch of the live sheet (extracted from
 * Sheet.tsx, audit item 19; redesigned to the poster layout, Phase 2).
 *
 * The body owns the identity band now (Workshop-Manual layout): SheetCrawler
 * passes NO `renderHero`, and `CrawlerSheet` renders the `SheetHero` band as
 * its first region (wrapping it with the `heroRef` from `renderBody`).
 * This component's remaining job is composing the economy band (the poster
 * `.econ` frame — `CrawlerEconFrame` — wrapping the SP `VitalGauge` + the
 * Tech-LVL/Upkeep/Upgrade/Trade/Crew lozenges, the R-4 action entry points),
 * which is handed to `CrawlerSheet` as `economy` and rendered as the identity
 * band's vitals rail, plus the docked-mech/lead-pilot rail content handed down
 * as `linkedUnits`. Owns the economy-dialog state (it was hoisted to Sheet
 * only because the branch wasn't a component).
 */

import { useState } from 'react'
import { EntityRow, VitalGauge } from 'component-lib'

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
import { RailCta } from './SheetRailParts'
import { AppLink } from '../shared/AppLink'
import { bayStates, mechRailItems, mechStatusPill, pilotRailItems, rowStats } from './railStats'
import type { SheetViewCommonProps } from './sheetViewProps'

type SheetCrawlerProps = SheetViewCommonProps & { crawler: Crawler }

/** The Upgrade pool's cap (rules C4). */
const UPGRADE_POOL_MAX = 30

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
    // Tech LVL is NOT here any more: it is the crawler's own rung, and it
    // reads in the identity beside the crawler type. The economy rail keeps the
    // things you SPEND (upkeep, upgrade pool, trade, crew).
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
    // Upgrade is NOT a flat readout: it FILLS toward a cap, which is what a
    // gauge shows and a number cannot. It renders as one below the SP gauge —
    // its Fund action still collects into the foot row with the others.
    ...(editable
      ? [
          {
            label: 'Upgrade',
            value: crawler.upgradePool ?? 0,
            actionOnly: true,
            action: {
              label: 'Fund',
              ariaLabel: 'Upgrade Crawler',
              onClick: () => setEconDialog('upgrade'),
            },
          },
        ]
      : []),
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
  ]

  // A crawler has no single "lead pilot" and no single docked mech: it is a
  // home for a CREW. Both slots are lists — every pilot wired to this crawler,
  // and every mech those pilots have — rather than the one-of-each the
  // composition resolver picks out for the two-hop mech lookup.
  const dockedMechs = composition.crawlerPilots
    .map((crewPilot) => {
      const link = storeState.softLinks.find(
        (l) => l.type === 'mech-to-pilot' && l.to.id === crewPilot.id
      )
      return link ? storeState.get('mech', link.from.id) : null
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  /** Unlink one pilot from this crawler (always available on editable sheets). */
  function unlinkPilot(pilotId: string) {
    const linkId = storeState.softLinks.find(
      (l) => l.type === 'pilot-to-crawler' && l.to.id === crawler.id && l.from.id === pilotId
    )?.id
    return editable && linkId ? () => void storeState.delete('softLink', linkId) : undefined
  }

  const rail = (
    <>
      {dockedMechs.length > 0 ? (
        dockedMechs.map((dockedMech) => (
          <EntityRow
            key={dockedMech.id}
            entityType="mech"
            className="flex-[1_1_0%]"
            name={dockedMech.name}
            sheetHref={`/sheet/mech/${dockedMech.id}`}
            linkAs={AppLink}
            meta="Docked Mech"
            metaLine={mechStatusPill(dockedMech).label}
            stats={rowStats(mechRailItems(dockedMech))}
          />
        ))
      ) : (
        <EntityRow
          empty
          entityType="mech"
          className="flex-[1_1_0%]"
          roleLabel="Docked Mechs"
          message="No mechs in the bay — dock one to repair, re-arm and track it from here."
          actions={editable ? <RailCta href="/mechs/new" label="+ Create" primary /> : undefined}
        />
      )}
      {composition.crawlerPilots.length > 0 ? (
        composition.crawlerPilots.map((crewPilot) => (
          <EntityRow
            key={crewPilot.id}
            entityType="pilot"
            className="flex-[1_1_0%]"
            name={crewPilot.name}
            sheetHref={`/sheet/pilot/${crewPilot.id}`}
            linkAs={AppLink}
            meta="Pilot"
            stats={rowStats(pilotRailItems(crewPilot))}
            onDeleteClick={unlinkPilot(crewPilot.id)}
          />
        ))
      ) : (
        <EntityRow
          empty
          entityType="pilot"
          className="flex-[1_1_0%]"
          roleLabel="Pilots"
          message="No pilots wired to this crawler yet."
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
      upgrade={
        <VitalGauge
          label="Upgrade"
          subLabel="Pool"
          value={crawler.upgradePool ?? 0}
          max={UPGRADE_POOL_MAX}
          onChange={editable ? (v) => patch({ upgradePool: v }) : undefined}
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
        renderBody={({ heroRef }) => (
          <CrawlerSheet
            crawler={crawler}
            mech={composition.mech}
            store={store}
            readOnly={readOnly}
            heroRef={heroRef}
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
