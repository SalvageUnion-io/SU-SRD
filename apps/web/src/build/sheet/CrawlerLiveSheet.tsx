import { NUMERIC_TECH_LEVELS } from 'salvageunion-reference/rules'
/**
 * CrawlerLiveSheet — the crawler branch of the live sheet (`Sheet`
 * dispatches to it).
 *
 * Its job is the crawler's numbers as rows (SP, the Upgrade Pool, Upkeep: the
 * dashboard's masthead), each live where the viewer may write and its max a
 * field in Edit, the economy's dialogs (Pay Upkeep, Fund, Trade) and their
 * state, the band's Tech Level stepper in Edit, and the Assigned units
 * (`assignedRail`), handed to `CrawlerSheet`.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import { useState } from 'react'
import {
  crawlerMaxSPParts,
  nextTierUpgradeCost,
  pinFor,
  resolvePool,
} from 'salvageunion-reference/rules'
import { linesFromBreakdown } from '../../components/app'
import type { PhoneVital } from '../../components/index'
import { Stat } from '../../components/index'
import { changeUndoToast } from '../../lib/changeUndoToast'
import { bayGate, upkeepOwed } from '../../lib/rules/crawlerEconomy'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_OVERRIDE } from '../../replica/provenance'
import { assignedRail } from './assignedRail'
import { crawlerStamp } from './bandStamps.model'
import type { CrawlerEconomyDialog } from './CrawlerEconomyControl'
import { CrawlerEconomyControl } from './CrawlerEconomyControl'
import { CrawlerSheet } from './CrawlerSheet'
import { changedFields, freshEntity } from './freshEntity.model'
import type { LiveSheetStripItem } from './LiveSheet'
import { LiveSheet } from './LiveSheet'
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
  const tl = crawler.techLevel
  // The Upgrade pool fills toward the next Tech Level's cost; at Tech 6 there
  // is none (crawler-tech-levels.json), so no gauge.
  const upgradeCost = nextTierUpgradeCost(tl)

  const strip: LiveSheetStripItem[] = [
    { key: 'sp', label: buildSheetCopy('sp'), value: sp, max: maxSP },
  ]
  // The Trading Bay sources TL+1 wares (p.223): its dialog is Trade.
  const trading = bayGate(crawler, 'trading-bay')

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

  // SP and the Upgrade pool are live wherever the viewer may write the sheet
  // (Read too, R11), each change said with Undo (K5).
  const writes = liveCondition || !readOnly
  const liveNumber = (field: 'currentSP' | 'upgradePool', label: string, from: number) =>
    writes
      ? (next: number) => {
          patch({ [field]: next })
          changeUndoToast({
            id: `crawler:${crawler.id}:${field}`,
            label,
            from,
            to: next,
            undo: (value) => patch({ [field]: value }),
            sheet: { id: crawler.id, field },
          })
        }
      : undefined
  // Pay / Fund / Trade: the economy's dialogs, on the masthead's foot.
  const economyActions: { label: string; dialog: CrawlerEconomyDialog }[] = writes
    ? [
        { label: buildSheetCopy('payUpkeep'), dialog: 'upkeep' },
        ...(upgradeCost === null
          ? []
          : [{ label: buildSheetCopy('fund'), dialog: 'upgrade' as const }]),
        ...(trading.present ? [{ label: buildSheetCopy('trade'), dialog: 'trade' as const }] : []),
      ]
    : []
  const onSp = liveNumber('currentSP', SHEET_VITALS.sp.short, sp)
  const onUpgrade = liveNumber('upgradePool', buildSheetCopy('upgrade'), crawler.upgradePool ?? 0)
  // The crawler's numbers as rows (R11): the dashboard's masthead draws them.
  // The Upkeep owed, after the type's own reduction, with its working (r4 A8).
  const upkeep = upkeepOwed(tl, crawler.type)
  const vitalRows: PhoneVital[] = [
    {
      key: 'sp',
      label: SHEET_VITALS.sp.short,
      name: SHEET_VITALS.sp.label,
      value: sp,
      max: maxSP,
      ...(onSp ? { onChange: onSp } : {}),
      ...(!readOnly && editable
        ? {
            maxEdit: {
              onMaxChange: (next: number) =>
                overrideCrawlerMax({ maxSpOverride: pinFor(next, spParts) }),
              breakdown: spParts,
              provenance: spLines,
              onRevertOverride: () => overrideCrawlerMax({ maxSpOverride: undefined }),
            },
          }
        : {}),
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
            ...(onUpgrade ? { onChange: onUpgrade } : {}),
          },
        ]),
    {
      key: 'upkeep',
      label: buildSheetCopy('upkeep'),
      name: buildSheetCopy('upkeep'),
      note:
        upkeep.less > 0
          ? `${buildSheetCopy('tScrapEachDowntime', { tl })} ${buildSheetCopy('upkeepWorking', upkeep)}`
          : buildSheetCopy('tScrapEachDowntime', { tl }),
      value: upkeep.owed,
    },
  ]
  const vitalActions = economyActions.map((action) => ({
    key: action.dialog,
    label: action.label,
    onClick: () => setEconDialog(action.dialog),
  }))

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
      {writes && (
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
