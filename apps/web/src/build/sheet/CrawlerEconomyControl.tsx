import type { UnitsStore } from '../../replica/units'
/**
 * CrawlerEconomyControl — the crawler-economy actions behind the hero's UPKEEP
 * / UPGRADE / TRADE spec lozenges (Core Book p.218-223): Pay Upkeep (with the
 * failed-Upkeep Deterioration roll), Upgrade Crawler, the fixed-rate Scrap
 * exchange, and the Trading Bay availability roll.
 *
 * WHY A LIFECYCLE TRANSACTION LIVES ON A FREE-EDIT SURFACE. ADR-021 puts
 * lifecycle transactions on the guided modes, so this control is an exception —
 * a **sanctioned** one, recorded in the "Sanctioned Live-Sheet transactions"
 * table in `docs/ARCHITECTURE.md#live-sheet`, the authoritative placement doc.
 * The short version: Play runs no crawler economy, the whole economy
 * hangs off the crawler hero's lozenges, nothing here blocks (every gate is a
 * disabled button plus a visible advisory), and `scrapPool` stays hand-editable
 * on the same sheet, so this is a convenience rather than the only door. If the
 * Play ever takes the crawler's economy, these three dialogs move there and
 * retag `PLAY_TXN`.
 *
 * Its writes are therefore `LIVE_SHEET_TXN`, not `LIVE_SHEET_MANUAL`: a rolled
 * Deterioration is not somebody typing in a box.
 *
 * ADR-007 automation boundary: deterministic bookkeeping auto-applies — the
 * Upkeep draw + Upgrade-Pool credit, the Deterioration SP loss and its "chosen
 * at random" Bay damage, the upgrade's TL bump / pool spend / bay repairs, and
 * the Scrap exchanges (`ExoticTrade` too). The Deterioration 6-10 band (the PLAYER chooses a Bay)
 * only shows an advisory; the availability roll is informational — buying the
 * sourced wares stays a table call.
 *
 * Rolls are ephemeral (nothing persists but the applied bookkeeping); the
 * control mounts only on editable sheets. Pure logic lives in
 * lib/rules/crawlerEconomy.ts (injectable d20); the Upkeep and Trading Bay
 * dialogs' UI state is a pair of pure reducers in
 * `crawlerEconomyDialogState.model.ts`.
 */

import { DOWNTIME_UPKEEP_SCRAP } from 'game-domain/rules/downtime'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { CSSProperties } from 'react'
import { useReducer, useState } from 'react'
import type { Roll } from 'salvageunion-reference/rules'
import { crawlerMaxSP, parseCrawlerTechLevel, resolvePool } from 'salvageunion-reference/rules'
import { capsLabel } from '../../components/atoms/capsLabel'
import {
  Button,
  Cluster,
  DialogActions,
  EmptyState,
  Eyebrow,
  FieldError,
  ModalShell,
  rollForTable,
  Select,
  Slab,
  Stack,
  Stat,
  tokens,
} from '../../components/index'
import { scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import {
  bayGate,
  contributeToUpgradePool,
  convertedCount,
  convertScrap,
  crawlerUpgradeQuote,
  payUpkeep,
  performDeterioration,
  performTradingRoll,
  poolAvailableAtOrAbove,
  SCRAP_TLS,
  TRADING_AVAILABILITY_LABEL,
  tradingSourceTl,
  upkeepShortfall,
} from '../../lib/rules/crawlerEconomy'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_TXN } from '../../replica/provenance'
import {
  describeDeterioration,
  INITIAL_UPKEEP_STATE,
  initialTradeState,
  tradeReducer,
  tradeStep,
  upkeepReducer,
} from './crawlerEconomyDialogState.model'
import { ExoticTrade } from './ExoticTrade'
import { freshEntity } from './freshEntity.model'

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  backgroundColor: tokens.color.paper,
  padding: tokens.space[20],
} satisfies CSSProperties

/** Body copy: the `sm` size rung, with its line height. */
const TEXT = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 1.25 / 0.875,
  color: tokens.color.ink,
} satisfies CSSProperties

const MUTED = { ...TEXT, color: tokens.color.wkMuted } satisfies CSSProperties

const TEXT_TIGHT = { ...TEXT, margin: 0 } satisfies CSSProperties

const TEXT_AFTER = { ...TEXT, marginTop: tokens.space[8] } satisfies CSSProperties

const CONTRIBUTE_LABEL = {
  fontSize: tokens.fontSize.xs,
  lineHeight: 1 / 0.75,
  color: tokens.color.ink,
} satisfies CSSProperties
const CONTRIBUTE_LABEL_CAPS = capsLabel({ tracking: 'snug' })

const SMALL = { fontSize: tokens.fontSize.xs, lineHeight: 1 / 0.75 } satisfies CSSProperties

const PICKERS = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: tokens.space[12],
} satisfies CSSProperties

const PICKER_LABEL = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[4],
} satisfies CSSProperties

/** A compact select: tighter than the `Select` skin's own padding. */
const PICKER = { padding: `${tokens.space[6]} ${tokens.space[8]}` } satisfies CSSProperties

const QTY = { display: 'inline-flex', paddingBottom: tokens.space[4] } satisfies CSSProperties

const ACTION_ROW = {
  marginTop: tokens.space[8],
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space[12],
} satisfies CSSProperties

/** Which economy dialog is open (the lozenge that was clicked). */
export type CrawlerEconomyDialog = 'upkeep' | 'upgrade' | 'trade'

const TRADING_BAY = 'trading-bay'

type CrawlerEconomyControlProps = {
  crawler: Crawler
  /** Injectable store — defaults to useUnits. */
  store: UnitsStore
  /** The open dialog; null renders nothing. */
  open: CrawlerEconomyDialog | null
  onClose: () => void
  /**
   * The dice for a roll on a table, by its name: d20s and the random Bay.
   * Injectable for tests; defaults to the UI library's `rollForTable`
   * (@randsum/salvageunion for Crawler Deterioration, a named table).
   */
  rollFor?: (tableName: string) => Promise<Roll>
}

export function CrawlerEconomyControl({
  crawler,
  store,
  open,
  onClose,
  rollFor = rollForTable,
}: CrawlerEconomyControlProps) {
  // Each dialog mounts only while open so its roll/result state resets.
  return (
    <>
      {open === 'upkeep' && (
        <UpkeepDialog crawler={crawler} store={store} rollFor={rollFor} onClose={onClose} />
      )}
      {open === 'upgrade' && <UpgradeDialog crawler={crawler} store={store} onClose={onClose} />}
      {open === 'trade' && (
        <TradeDialog crawler={crawler} store={store} rollFor={rollFor} onClose={onClose} />
      )}
    </>
  )
}

type DialogProps = {
  crawler: Crawler
  store: UnitsStore
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Pay Upkeep + failed-Upkeep Deterioration (p.218-219)
// ---------------------------------------------------------------------------

type RollFor = { rollFor: (tableName: string) => Promise<Roll> }

function UpkeepDialog({ crawler, store, rollFor, onClose }: DialogProps & RollFor) {
  const storeState = store()
  const [{ result, choosePrompt, done }, dispatch] = useReducer(upkeepReducer, INITIAL_UPKEEP_STATE)

  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  const pool = crawler.scrapPool ?? {}
  const available = poolAvailableAtOrAbove(pool, tl)
  const shortfall = upkeepShortfall(pool, tl)
  const quote = crawlerUpgradeQuote(tl, crawler.upgradePool ?? 0)

  /** Pay: draw 5×TL+ scrap, credit the Upgrade Pool in full (auto-applies). */
  async function handlePay() {
    const fresh = freshEntity(storeState, 'crawler', crawler)
    const freshTl = parseCrawlerTechLevel(fresh.techLevel) ?? 1
    const payment = payUpkeep(fresh.scrapPool ?? {}, freshTl)
    if (!payment) {
      dispatch({ type: 'payFailed' })
      return
    }
    const nextUpgradePool = (fresh.upgradePool ?? 0) + payment.upgradeCredit
    await storeState.update(
      'crawler',
      crawler.id,
      {
        scrapPool: payment.pool,
        upgradePool: nextUpgradePool,
      },
      LIVE_SHEET_TXN
    )
    const drawText = payment.draws.map((d) => `${d.count}× T${d.tl}`).join(' + ')
    dispatch({
      type: 'paid',
      message: `Paid ${DOWNTIME_UPKEEP_SCRAP} Scrap (${drawText}) — Upgrade Pool now ${nextUpgradePool}${
        quote ? ` of ${quote.cost}` : ''
      }.`,
    })
  }

  /**
   * Failed Upkeep: roll the Deterioration Table. SP loss and the "chosen at
   * random" Bay damage auto-apply; the 6-10 band leaves the Bay pick to the
   * player (ADR-007).
   */
  async function handleDeterioration() {
    const roll = await rollFor('Crawler Deterioration')
    const fresh = freshEntity(storeState, 'crawler', crawler)
    const bays = fresh.crawlerBays ?? []
    const maxSP = crawlerMaxSP(fresh)
    const currentSP = resolvePool(fresh.currentSP, maxSP)
    const effect = performDeterioration({ currentSP, bayCount: bays.length, roll })

    if (effect.spLoss > 0) {
      await storeState.update('crawler', crawler.id, { currentSP: effect.nextSP }, LIVE_SHEET_TXN)
    }
    let bayName: string | null = null
    if (effect.randomBayIndex !== null) {
      const entry = bays[effect.randomBayIndex]
      if (entry) {
        await storeState.updateCrawlerBay(
          crawler.id,
          entry.bayRef,
          { condition: 'damaged' },
          effect.randomBayIndex,
          LIVE_SHEET_TXN
        )
        bayName = resolveCrawlerBay(entry.bayRef)?.name ?? entry.bayRef
      }
    }
    dispatch({
      type: 'deteriorated',
      message: describeDeterioration(effect, bayName),
      choosePrompt: effect.requiresPlayerChoice,
    })
  }

  return (
    <ModalShell
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={buildSheetCopy('payUpkeep')}
      subtitle={buildSheetCopy('techScrapPerDowntime', {
        downtimeUpkeepScrap: DOWNTIME_UPKEEP_SCRAP,
        tl,
      })}
      width="narrow"
    >
      <div style={BODY}>
        <p style={MUTED}>
          {buildSheetCopy('upkeepCostsScrapOfTech', {
            downtimeUpkeepScrap: DOWNTIME_UPKEEP_SCRAP,
            tl,
          })}
        </p>
        <p style={TEXT}>
          Pool holds <strong>{available}</strong> scrap at Tech {tl}+.
        </p>

        {!done && shortfall > 0 && (
          <FieldError>{buildSheetCopy('thePoolIsScrapShort', { shortfall })}</FieldError>
        )}

        {result && (
          <p role="status" style={TEXT}>
            {result}
          </p>
        )}
        {choosePrompt && <FieldError>{buildSheetCopy('chooseABayAndMark')}</FieldError>}

        <DialogActions>
          <Button variant="ghost" size="compact" onClick={onClose}>
            {done ? buildSheetCopy('done') : buildSheetCopy('cancel')}
          </Button>
          {!done && shortfall === 0 && (
            <Button
              variant="primary"
              size="compact"
              onClick={() => {
                void handlePay()
              }}
            >
              {buildSheetCopy('payUpkeep')}
            </Button>
          )}
          {!done && shortfall > 0 && (
            <Button
              variant="primary"
              size="compact"
              onClick={() => {
                void handleDeterioration()
              }}
            >
              {buildSheetCopy('rollDeteriorationD20')}
            </Button>
          )}
        </DialogActions>
      </div>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Upgrade Crawler (p.218-219)
// ---------------------------------------------------------------------------

function UpgradeDialog({ crawler, store, onClose }: DialogProps) {
  const storeState = store()
  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  const upgradePool = crawler.upgradePool ?? 0
  const quote = crawlerUpgradeQuote(tl, upgradePool)
  const pool = crawler.scrapPool ?? {}
  const contributable = poolAvailableAtOrAbove(pool, tl)
  const [contribution, setContribution] = useState(1)

  /** Voluntary acceleration (p.218): move pool scrap into the Upgrade Pool. */
  async function handleContribute() {
    const fresh = freshEntity(storeState, 'crawler', crawler)
    const freshTl = parseCrawlerTechLevel(fresh.techLevel) ?? 1
    const result = contributeToUpgradePool(fresh.scrapPool ?? {}, freshTl, contribution)
    if (!result) return
    await storeState.update(
      'crawler',
      crawler.id,
      {
        scrapPool: result.pool,
        upgradePool: (fresh.upgradePool ?? 0) + contribution,
      },
      LIVE_SHEET_TXN
    )
  }

  /** Consume the pool, bump the Tech Level, repair damaged Bays (p.219). */
  async function handleUpgrade() {
    const fresh = freshEntity(storeState, 'crawler', crawler)
    const freshTl = parseCrawlerTechLevel(fresh.techLevel) ?? 1
    const freshQuote = crawlerUpgradeQuote(freshTl, fresh.upgradePool ?? 0)
    if (!freshQuote?.affordable) return
    const patch: Partial<Crawler> = {
      techLevel: `tech-${freshQuote.toTl}`,
      upgradePool: freshQuote.remainingPool,
    }
    const bays = fresh.crawlerBays ?? []
    if (bays.some((bay) => (bay.condition ?? 'intact') === 'damaged')) {
      patch.crawlerBays = bays.map((bay) => ({ ...bay, condition: 'intact' as const }))
    }
    await storeState.update('crawler', crawler.id, patch, LIVE_SHEET_TXN)
    onClose()
  }

  return (
    <ModalShell
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={buildSheetCopy('upgradeCrawler')}
      width="narrow"
    >
      <div style={BODY}>
        {quote ? (
          <Stack gap={12}>
            <p>
              Upgrading from Tech {quote.fromTl} to Tech {quote.toTl} consumes{' '}
              <strong>{quote.cost}</strong> from the Upgrade Pool (currently{' '}
              <strong>{upgradePool}</strong>). Damaged Bays are repaired during the upgrade; Upkeep
              rises to {DOWNTIME_UPKEEP_SCRAP}× Tech {quote.toTl} Scrap.
            </p>
            {!quote.affordable && (
              <FieldError>
                {buildSheetCopy('theUpgradePoolIsShort', { value: quote.cost - upgradePool })}
              </FieldError>
            )}
            <Cluster gap={8}>
              <span className={CONTRIBUTE_LABEL_CAPS} style={CONTRIBUTE_LABEL}>
                {buildSheetCopy('contributeScrapTech', { tl })}
              </span>
              <Stat
                size="mini"
                label={buildSheetCopy('scrap')}
                value={contribution}
                min={1}
                max={contributable}
                mode="edit"
                stepperLabel="contribution"
                onChange={setContribution}
              />
              <Button
                size="compact"
                variant="default"
                disabled={contributable === 0 || contribution > contributable}
                title={buildSheetCopy('moveScrapTechOrHigher', { contribution, tl })}
                onClick={() => {
                  void handleContribute()
                }}
              >
                {buildSheetCopy('addToUpgradePool')}
              </Button>
            </Cluster>
            <p style={SMALL}>{buildSheetCopy('poolHoldsScrapAtTech', { contributable, tl })}</p>
          </Stack>
        ) : (
          <p>{buildSheetCopy('tech6IsTheHighest')}</p>
        )}
        <DialogActions>
          <Button variant="ghost" size="compact" onClick={onClose}>
            {buildSheetCopy('cancel')}
          </Button>
          <Button
            variant="primary"
            size="compact"
            onClick={() => {
              void handleUpgrade()
            }}
            disabled={!quote?.affordable}
          >
            {quote
              ? buildSheetCopy('upgradeToTech', { toTl: quote.toTl })
              : buildSheetCopy('upgrade')}
          </Button>
        </DialogActions>
      </div>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Trading Bay — fixed-rate Scrap exchange + availability roll (p.223)
// ---------------------------------------------------------------------------

function TradeDialog({ crawler, store, rollFor, onClose }: DialogProps & RollFor) {
  const storeState = store()
  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  const gate = bayGate(crawler, TRADING_BAY)
  const pool = crawler.scrapPool ?? {}

  const [{ fromTl, toTl, count, convertNote, availability }, dispatch] = useReducer(
    tradeReducer,
    undefined,
    initialTradeState
  )

  // The stepper moves in whole exchange steps; `count` is re-seated on one
  // whenever the pair changes (`tradeReducer`), so it is always a multiple.
  const step = tradeStep(fromTl, toTl)
  const toCount = convertedCount(fromTl, count, toTl)
  const bucket = scrapPoolBucket(pool, fromTl)
  const convertible =
    gate.operational && fromTl !== toTl && toCount !== null && count > 0 && bucket >= count

  /** Apply the fixed equal-value exchange to the pool buckets (auto-applies). */
  async function handleConvert() {
    const fresh = freshEntity(storeState, 'crawler', crawler)
    const result = convertScrap(fresh.scrapPool ?? {}, fromTl, count, toTl)
    if (!result) {
      dispatch({ type: 'converted', note: buildSheetCopy('thePoolNoLongerCovers') })
      return
    }
    await storeState.update('crawler', crawler.id, { scrapPool: result.pool }, LIVE_SHEET_TXN)
    dispatch({
      type: 'converted',
      note: buildSheetCopy('tradedTForT', { count, fromTl, toCount: result.toCount, toTl }),
    })
  }

  /** Once per Downtime (honor system) — what the wastelanders brought. */
  async function handleAvailabilityRoll() {
    const roll = await rollFor('Trading Bay')
    dispatch({ type: 'rolled', result: performTradingRoll({ crawlerTl: tl, roll }) })
  }

  return (
    <ModalShell
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={buildSheetCopy('tradingBay')}
      subtitle={buildSheetCopy('scrapExchangeDowntimeSourcingTech', { tl })}
      width="narrow"
    >
      <div style={BODY}>
        {!gate.present && (
          <EmptyState variant="quiet" body={buildSheetCopy('thisCrawlerHasNoTrading')} />
        )}
        {gate.damaged && <FieldError>{buildSheetCopy('theTradingBayIsDamaged')}</FieldError>}

        {gate.operational && (
          <>
            <div>
              <Slab
                label={buildSheetCopy('tradeScrap')}
                count="fixed equal-value rates · no bartering"
              />
              <div style={PICKERS}>
                <Eyebrow as="label" tone="ink" htmlFor="trade-from-tl" style={PICKER_LABEL}>
                  From
                  <Select
                    id="trade-from-tl"
                    style={PICKER}
                    value={fromTl}
                    onChange={(e) => dispatch({ type: 'pickFrom', tl: Number(e.target.value) })}
                  >
                    {SCRAP_TLS.map((t) => (
                      <option key={t} value={t}>
                        {buildSheetCopy('techInPool', {
                          t,
                          scrapPoolBucket: scrapPoolBucket(pool, t),
                        })}
                      </option>
                    ))}
                  </Select>
                </Eyebrow>
                <Eyebrow as="label" tone="ink" htmlFor="trade-to-tl" style={PICKER_LABEL}>
                  To
                  <Select
                    id="trade-to-tl"
                    style={PICKER}
                    value={toTl}
                    onChange={(e) => dispatch({ type: 'pickTo', tl: Number(e.target.value) })}
                  >
                    {SCRAP_TLS.map((t) => (
                      <option key={t} value={t}>
                        {buildSheetCopy('tech', { t })}
                      </option>
                    ))}
                  </Select>
                </Eyebrow>
                <span style={QTY}>
                  <Stat
                    size="mini"
                    label={buildSheetCopy('qty')}
                    value={count}
                    min={step}
                    step={step}
                    mode="edit"
                    stepperLabel={buildSheetCopy('tradeAmountBy', { step })}
                    onChange={(next) => dispatch({ type: 'setCount', count: next })}
                  />
                </span>
              </div>
              <div style={ACTION_ROW}>
                <p style={TEXT_TIGHT} data-testid="trade-preview">
                  {fromTl === toTl
                    ? buildSheetCopy('pickTwoDifferentTechLevels')
                    : toCount === null
                      ? buildSheetCopy('notAnExactTradeThe')
                      : buildSheetCopy('tT', { count, fromTl, toCount, toTl })}
                </p>
                <Button
                  size="compact"
                  variant="primary"
                  disabled={!convertible}
                  title={
                    bucket < count
                      ? buildSheetCopy('thePoolOnlyHoldsT', { bucket, fromTl })
                      : buildSheetCopy('applyTheExchangeToThe')
                  }
                  onClick={() => {
                    void handleConvert()
                  }}
                >
                  {buildSheetCopy('trade')}
                </Button>
              </div>
              {convertNote && (
                <p role="status" style={TEXT_AFTER}>
                  {convertNote}
                </p>
              )}
            </div>

            <ExoticTrade crawler={crawler} store={store} />
            <div>
              <Slab
                label={buildSheetCopy('sourceWares')}
                count={`once per Downtime · wares are Tech ${tradingSourceTl(tl)}`}
              />
              <p style={MUTED}>{buildSheetCopy('oncePerDowntimeRollTo')}</p>
              <div style={ACTION_ROW}>
                <Button size="compact" variant="primary" onClick={handleAvailabilityRoll}>
                  {buildSheetCopy('rollAvailabilityD20')}
                </Button>
                {availability && (
                  <p role="status" style={TEXT_TIGHT}>
                    Rolled {availability.roll}:{' '}
                    {TRADING_AVAILABILITY_LABEL[availability.availability]}
                    {availability.availability !== 'nothing' &&
                      buildSheetCopy('tech2', { sourceTl: availability.sourceTl })}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <DialogActions>
          <Button variant="ghost" size="compact" onClick={onClose}>
            {buildSheetCopy('close')}
          </Button>
        </DialogActions>
      </div>
    </ModalShell>
  )
}
