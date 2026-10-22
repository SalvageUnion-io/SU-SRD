/**
 * CrawlerLiveSheet — the crawler branch of the live sheet (`Sheet`
 * dispatches to it), in the poster layout.
 *
 * The body owns the identity band (Workshop-Manual layout): `CrawlerSheet`
 * renders the `SheetHero` band as its first region.
 * This component's remaining job is composing the economy band (the poster
 * `.econ` frame — `CrawlerEconFrame` — wrapping the SP `VitalGauge` + the
 * Tech-LVL/Upkeep/Upgrade/Trade/Crew lozenges) and its action entry points
 * (`CrawlerEconActions`), handed to `CrawlerSheet` as `economy` and
 * `economyActions` and rendered as the identity band's vitals card and its head
 * chips, plus the Assigned units (`assignedUnitsFor`) handed down as
 * `linkedUnits`. Owns the economy-dialog state.
 */

import { containerOf } from 'game-domain/container'
import type { Crawler } from 'game-domain/schemas/crawler'
import { useState } from 'react'
import {
  crawlerMaxSPParts,
  parseCrawlerTechLevel,
  pinFor,
  resolvePool,
} from 'salvageunion-reference/rules'
import { linesFromBreakdown, Stat } from '../../components/index'
import { bayGate, SCRAP_TLS, tradingSourceTl } from '../../lib/rules/crawlerEconomy'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_OVERRIDE } from '../../stores/surfaceProvenance'
import { AssignPicker } from '../wiring/AssignPicker'
import { AssignedUnits } from './AssignedUnits'
import { assignedUnitsFor, hasAssignedUnits } from './assignedUnits.model'
import { crawlerStamp } from './bandStamps.model'
import type { EconLozItem } from './CrawlerEcon'
import { CrawlerEconActions, CrawlerEconFrame } from './CrawlerEcon'
import type { CrawlerEconomyDialog } from './CrawlerEconomyControl'
import { CrawlerEconomyControl } from './CrawlerEconomyControl'
import { CrawlerSheet } from './CrawlerSheet'
import { changedFields, freshEntity } from './freshEntity.model'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
import { bayStates } from './railStats.model'
import { SheetVitalGauge } from './SheetVitalGauge'
import type { SheetViewCommonProps } from './sheetViewProps.model'

type CrawlerLiveSheetProps = SheetViewCommonProps & {
  crawler: Crawler
  /**
   * The viewer may write this sheet, in Read too: a bay's condition still
   * steps in Read, as the SP gauge does. Absent, as `editable`.
   */
  liveCondition?: boolean
}

/** The Upgrade pool's cap. */
const UPGRADE_POOL_MAX = 30

export function CrawlerLiveSheet({
  crawler,
  composition,
  actions,
  segments,
  band,
  editable,
  readOnly,
  liveCondition = editable,
  ownerOf,
  store,
  storeState,
  holds,
  hrefFor,
  withheld,
  patch,
}: CrawlerLiveSheetProps) {
  // Crawler-economy dialog behind the UPKEEP/UPGRADE/TRADE lozenges.
  const [econDialog, setEconDialog] = useState<CrawlerEconomyDialog | null>(null)

  const spParts = crawlerMaxSPParts(crawler)
  const maxSP = spParts.total
  const spLines = linesFromBreakdown(spParts, {
    base: `Tech ${crawler.techLevel?.replace(/\D/g, '') || '?'} Crawler`,
    baseDetail: 'base',
    installed: 'Crawler type bonus',
  })
  const sp = resolvePool(crawler.currentSP, maxSP)
  // Cap override (ADR-022, Free Edit): pin Max SP as an absolute
  // `maxSpOverride`; the gauge shows "overridden from N" + a revert. Tagged
  // `override`. The pin is normalised with `pinFor` (equal to the derivation
  // means none), and a commit that changes nothing is not written.
  const overrideCrawlerMax = (fields: Partial<Crawler>) => {
    const changed = changedFields(freshEntity(storeState, 'crawler', crawler), fields)
    if (!changed) return
    runWrite(() => storeState.update('crawler', crawler.id, changed, LIVE_SHEET_OVERRIDE))
  }
  const states = bayStates(crawler)
  const intactBays = states.filter((s) => s === 'intact').length
  const tl = parseCrawlerTechLevel(crawler.techLevel)

  const strip: LiveSheetStripItem[] = [
    { key: 'sp', label: buildSheetCopy('sp'), value: sp, max: maxSP },
    ...(states.length > 0
      ? [
          {
            key: 'bays',
            label: buildSheetCopy('bays'),

            value: intactBays,
            max: states.length,
          },
        ]
      : []),
  ]

  // Tech LVL / UPKEEP / UPGRADE-pool / TRADE / CREW lozenges (poster
  // `.lozrow`): upkeep is 5 Scrap of crawler TL per Downtime;
  // the Upgrade Pool fills toward 30× TL; the Trading Bay
  // sources TL+1 wares (p.223); crew leads = one per installed bay.
  // On editable sheets the actionable lozenges (Upkeep/Upgrade/Trade)
  // are the economy action entry points (CrawlerEconomyControl); Tech LVL and
  // Crew are read-only readouts.
  const trading = bayGate(crawler, 'trading-bay')
  const econItems: EconLozItem[] = [
    // Tech LVL is NOT here any more: it is the crawler's own rung, and it
    // reads as the band's TL chip beside the crawler type. The economy rail keeps the
    // things you SPEND (upkeep, upgrade pool, trade, crew).
    ...(tl !== undefined
      ? [
          {
            label: buildSheetCopy('upkeep'),
            value: 5,
            caption: buildSheetCopy('tScrap', { tl }),
            action: editable
              ? {
                  label: buildSheetCopy('pay'),
                  ariaLabel: buildSheetCopy('payUpkeep'),
                  onClick: () => setEconDialog('upkeep'),
                }
              : undefined,
          },
        ]
      : []),
    // Upgrade is NOT a flat readout: it FILLS toward a cap, which is what a
    // gauge shows and a number cannot. It renders as one below the SP gauge —
    // its Fund action still collects onto the Vitals card's head with the others.
    ...(editable
      ? [
          {
            label: buildSheetCopy('upgrade'),
            value: crawler.upgradePool ?? 0,
            actionOnly: true,
            action: {
              label: buildSheetCopy('fund'),
              ariaLabel: buildSheetCopy('upgradeCrawler'),
              onClick: () => setEconDialog('upgrade'),
            },
          },
        ]
      : []),
    ...(trading.present && tl !== undefined
      ? [
          {
            // Its Trade action only: the rail reads no Trade.
            label: buildSheetCopy('trade'),
            value: tradingSourceTl(tl),
            actionOnly: true,
            action: editable
              ? {
                  label: buildSheetCopy('trade'),
                  ariaLabel: buildSheetCopy('openTheTradingBay'),
                  onClick: () => setEconDialog('trade'),
                }
              : undefined,
          },
        ]
      : []),
  ]

  // Assigned units: a crawler is a home for a CREW, with no single lead
  // pilot or docked mech. Both places are lists — every mech docked by its OWN
  // `mech-to-crawler` link (ADR-037), then every pilot wired to it — and each
  // keeps its Assign after the first. A mech is assigned independently of its
  // pilot, so a crew pilot's mech docked elsewhere is not in this bay, and a
  // docked mech with no pilot still is.
  const self = { type: 'crawler', id: crawler.id } as const
  const container = containerOf(crawler)
  const assigned = assignedUnitsFor({
    subject: { kind: 'crawler', entity: crawler },
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
  })
  const rail = hasAssignedUnits(assigned.units, editable) ? (
    <AssignedUnits {...assigned} editable={editable} />
  ) : undefined

  // Economy band (poster `.econ`: SP `VitalGauge` over the Tech-LVL/Upkeep/
  // Upgrade/Trade/Crew lozenges) — built here because it needs `patch` +
  // the econDialog state, which CrawlerSheet does not own; handed down as
  // `economy` and rendered inside the body's Identity card.
  const economy = (
    <CrawlerEconFrame
      gauge={
        <SheetVitalGauge
          vital="sp"
          value={sp}
          max={maxSP}
          onChange={editable ? (v) => patch({ currentSP: v }) : undefined}
          onMaxChange={
            editable
              ? (next) => overrideCrawlerMax({ maxSpOverride: pinFor(next, spParts) })
              : undefined
          }
          breakdown={editable ? spParts : undefined}
          provenance={editable ? spLines : undefined}
          onRevertOverride={
            editable ? () => overrideCrawlerMax({ maxSpOverride: undefined }) : undefined
          }
          readOnly={!editable}
        />
      }
      upgrade={
        <SheetVitalGauge
          vital="upgrade"
          value={crawler.upgradePool ?? 0}
          max={UPGRADE_POOL_MAX}
          onChange={editable ? (v) => patch({ upgradePool: v }) : undefined}
          readOnly={!editable}
        />
      }
      items={econItems}
    />
  )
  // Pay / Fund / Trade: chips on the Vitals card's head, not a row in its body.
  const economyActions = econItems.some((item) => item.action) ? (
    <CrawlerEconActions items={econItems} />
  ) : undefined

  return (
    <>
      <LiveSheet
        variant="crawler"
        name={crawler.name}
        strip={strip}
        segments={segments}
        band={band}
        source={crawler.seedRef ? 'starter' : undefined}
        kindDetail={crawlerStamp(crawler.type)}
        // The crawler's rung is the band's TL chip, ahead of its type (C2's
        // rank before relation); Edit grows its stepper on the chip, a Free
        // Edit of the stored rung (the Upgrade dialog is the play path).
        rank={
          <Stat
            label={buildSheetCopy('tl')}
            value={tl ?? '—'}
            mode={readOnly || tl === undefined ? 'read' : 'edit'}
            onChange={
              readOnly || tl === undefined
                ? undefined
                : (next) => patch({ techLevel: `tech-${next}` })
            }
            min={SCRAP_TLS[0]}
            ceiling={SCRAP_TLS[SCRAP_TLS.length - 1]}
            stepperLabel={buildSheetCopy('techLevel')}
          />
        }
        actions={actions}
        renderBody={() => (
          <CrawlerSheet
            crawler={crawler}
            mech={composition.mech}
            mechHref={composition.mech ? hrefFor('mech', composition.mech.id) : undefined}
            store={store}
            readOnly={readOnly}
            liveCondition={liveCondition}
            economy={economy}
            economyActions={economyActions}
            linkedUnits={rail}
            crew={composition.crew}
            crewHref={
              readOnly ? undefined : `/npcs/new?view=crew&crawler=${encodeURIComponent(crawler.id)}`
            }
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
