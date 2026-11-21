import { NUMERIC_TECH_LEVELS } from 'salvageunion-reference/rules'
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
 * chips, plus the Related units (`assignedUnitsFor`) handed down as
 * `linkedUnits`. Owns the economy-dialog state.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import { useState } from 'react'
import {
  crawlerMaxSPParts,
  nextTierUpgradeCost,
  pinFor,
  resolvePool,
} from 'salvageunion-reference/rules'
import { linesFromBreakdown, PhoneVitals } from '../../components/app'
import type { PhoneVital } from '../../components/index'
import { Button, Stat } from '../../components/index'
import { changeUndoToast } from '../../lib/changeUndoToast'
import { bayGate, tradingSourceTl } from '../../lib/rules/crawlerEconomy'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_OVERRIDE } from '../../replica/provenance'
import { assignedRail } from './assignedRail'
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
import { SHEET_VITALS } from './sheetVitals.model'

type CrawlerLiveSheetProps = SheetViewCommonProps & {
  crawler: Crawler
  /**
   * The viewer may write this sheet, in Read too: a bay's condition still
   * steps in Read, as the SP gauge does. Absent, as `editable`.
   */
  liveCondition?: boolean
}

export function CrawlerLiveSheet({
  crawler,
  composition,
  actions,
  segments,
  band,
  editable,
  readOnly,
  liveCondition = editable,
  liveInRead = false,
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
    base: `Tech ${crawler.techLevel} Crawler`,
    baseDetail: 'base',
    installed: buildSheetCopy('crawlerTypeBonus'),
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
  const tl = crawler.techLevel
  // The Upgrade pool fills toward the next Tech Level's cost; at Tech 6 there
  // is none (crawler-tech-levels.json), so no gauge.
  const upgradeCost = nextTierUpgradeCost(tl)

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
    // Upgrade is a counter toward its cap (§2.1, as Training Points), its Fund
    // action with the others on the Vitals card's head.
    ...(upgradeCost === null
      ? []
      : [
          {
            label: buildSheetCopy('upgrade'),
            value: crawler.upgradePool ?? 0,
            max: upgradeCost,
            ...(editable
              ? {
                  onChange: (v: number) => patch({ upgradePool: v }),
                  action: {
                    label: buildSheetCopy('fund'),
                    ariaLabel: buildSheetCopy('upgradeCrawler'),
                    onClick: () => setEconDialog('upgrade'),
                  },
                }
              : {}),
          },
        ]),
    ...(trading.present
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

  // Related units: a crawler is a home for a CREW, with no single lead
  // pilot or docked mech. Both places are lists — every mech docked by its OWN
  // `mech-to-crawler` link (ADR-037), then every pilot wired to it — and each
  // keeps its Assign after the first. A mech is assigned independently of its
  // pilot, so a crew pilot's mech docked elsewhere is not in this bay, and a
  // docked mech with no pilot still is.
  const rail = assignedRail(
    { kind: 'crawler', entity: crawler },
    { composition, withheld, storeState, holds, hrefFor, ownerOf, editable, liveInRead }
  )

  // Economy band (poster `.econ`: SP `VitalGauge` over the Tech-LVL/Upkeep/
  // Upgrade/Trade/Crew lozenges) — built here because it needs `patch` +
  // the econDialog state, which CrawlerSheet does not own; handed down as
  // `economy` and rendered inside the body's Identity card.
  // SP and the Upgrade pool are live in Read where the viewer may write the
  // sheet (`liveCondition`, R11), each change said with Undo (K5).
  const liveNumber = (field: 'currentSP' | 'upgradePool', label: string, from: number) =>
    liveCondition
      ? (next: number) => {
          patch({ [field]: next })
          changeUndoToast({
            id: `crawler:${crawler.id}:${field}`,
            label,
            from,
            to: next,
            undo: (value) => patch({ [field]: value }),
          })
        }
      : undefined
  const economy = (
    <CrawlerEconFrame
      gauge={
        <SheetVitalGauge
          vital="sp"
          value={sp}
          max={maxSP}
          onChange={liveNumber('currentSP', SHEET_VITALS.sp.short, sp)}
          steppers={liveCondition ? 'end' : false}
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
          readOnly={!liveCondition}
        />
      }
      items={econItems}
    />
  )
  // The phone's block (`PhoneVitals`): SP, the Upgrade pool toward its cost,
  // and Upkeep as a counter; Pay / Fund / Trade are its foot, outlined as
  // everywhere they stand (§3.14).
  const phoneActions: { label: string; dialog: CrawlerEconomyDialog }[] = liveCondition
    ? [
        { label: buildSheetCopy('payUpkeep'), dialog: 'upkeep' },
        ...(upgradeCost === null
          ? []
          : [{ label: buildSheetCopy('fund'), dialog: 'upgrade' as const }]),
        ...(trading.present ? [{ label: buildSheetCopy('trade'), dialog: 'trade' as const }] : []),
      ]
    : []
  // The crawler's numbers as rows (R11): what a phone's block and the sheet
  // dashboard's header strip both draw.
  const vitalRows: PhoneVital[] = [
    {
      key: 'sp',
      label: SHEET_VITALS.sp.short,
      name: SHEET_VITALS.sp.label,
      value: sp,
      max: maxSP,
      onChange: liveNumber('currentSP', SHEET_VITALS.sp.short, sp),
    },
    ...(upgradeCost === null
      ? []
      : [
          {
            key: 'upgrade',
            label: buildSheetCopy('upgrade'),
            name: buildSheetCopy('upgradePool'),
            value: crawler.upgradePool ?? 0,
            max: upgradeCost,
            onChange: liveNumber(
              'upgradePool',
              buildSheetCopy('upgrade'),
              crawler.upgradePool ?? 0
            ),
          },
        ]),
    {
      key: 'upkeep',
      label: buildSheetCopy('upkeep'),
      name: buildSheetCopy('upkeep'),
      note: buildSheetCopy('tScrapEachDowntime', { tl }),
      value: 5,
    },
  ]
  const vitalActions = phoneActions.map((action) => ({
    key: action.dialog,
    label: action.label,
    onClick: () => setEconDialog(action.dialog),
  }))
  const phoneVitals = (
    <PhoneVitals
      label={buildSheetCopy('unitVitals', { name: crawler.name })}
      vitals={vitalRows}
      foot={
        phoneActions.length > 0
          ? phoneActions.map((action) => (
              <Button
                key={action.dialog}
                variant="default"
                size="full"
                onClick={() => setEconDialog(action.dialog)}
              >
                {action.label}
              </Button>
            ))
          : undefined
      }
    />
  )
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
        pinsVitals={readOnly}
        // Read's header strip carries the
        // Tech Level with the crawler's other figures, so the band leaves it
        // out (R59); Edit keeps its stepper here.
        rank={
          readOnly ? undefined : (
            <Stat
              label={buildSheetCopy('tl')}
              value={tl}
              mode="edit"
              onChange={(next) => patch({ techLevel: next })}
              min={NUMERIC_TECH_LEVELS[0]}
              ceiling={NUMERIC_TECH_LEVELS[NUMERIC_TECH_LEVELS.length - 1]}
              stepperLabel={buildSheetCopy('techLevel')}
            />
          )
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
            phoneVitals={phoneVitals}
            vitalRows={vitalRows}
            vitalActions={vitalActions}
            linkedUnits={rail}
            crew={composition.crew}
            crewHref={
              readOnly ? undefined : `/npcs/new?view=crew&crawler=${encodeURIComponent(crawler.id)}`
            }
          />
        )}
      />
      {(editable || liveCondition) && (
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
