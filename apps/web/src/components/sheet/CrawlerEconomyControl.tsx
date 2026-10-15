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
 * The short version: the crawler has no Dashboard presence, the whole economy
 * hangs off the crawler hero's lozenges, nothing here blocks (every gate is a
 * disabled button plus a visible advisory), and `scrapPool` stays hand-editable
 * on the same sheet, so this is a convenience rather than the only door. If the
 * crawler ever gets a Dashboard presence, these three dialogs move there and
 * retag `DASHBOARD_TXN`.
 *
 * Its writes are therefore `LIVE_SHEET_TXN`, not `LIVE_SHEET_MANUAL`: a rolled
 * Deterioration is not somebody typing in a box.
 *
 * ADR-007 automation boundary: deterministic bookkeeping auto-applies — the
 * Upkeep draw + Upgrade-Pool credit, the Deterioration SP loss and its "chosen
 * at random" Bay damage, the upgrade's TL bump / pool spend / bay repairs, and
 * the Scrap exchange. The Deterioration 6-10 band (the PLAYER chooses a Bay)
 * only shows an advisory; the availability roll is informational — buying the
 * sourced wares stays a table call.
 *
 * Rolls are ephemeral (nothing persists but the applied bookkeeping); the
 * control mounts only on editable sheets. Pure logic lives in
 * lib/rules/crawlerEconomy.ts (injectable d20); the Upkeep and Trading Bay
 * dialogs' UI state is a pair of pure reducers in
 * `crawlerEconomyDialogState.model.ts`.
 */

import { DOWNTIME_UPKEEP_SCRAP } from 'cantina-domain/rules/downtime'
import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { CSSProperties } from 'react'
import { useReducer, useState } from 'react'
import { plainTraitText, resultForTable, SalvageUnionReference } from 'salvageunion-reference'
import type { Roll } from 'salvageunion-reference/rules'
import { crawlerMaxSP, parseCrawlerTechLevel, resolvePool } from 'salvageunion-reference/rules'
import { scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import type { DeteriorationEffect } from '../../lib/rules/crawlerEconomy'
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
import type { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_TXN } from '../../stores/surfaceProvenance'
import {
  Button,
  EmptyState,
  FieldError,
  ModalShell,
  rollForTable,
  Select,
  Slab,
  Stat,
  tokens,
} from '../index'
import { freshEntity } from './controlPrimitives'
import {
  INITIAL_UPKEEP_STATE,
  initialTradeState,
  tradeReducer,
  tradeStep,
  upkeepReducer,
} from './crawlerEconomyDialogState.model'

/** The dialogs' width cap: `ModalShell` takes it as a class. */
const DIALOG_WIDTH = 'su-sheet-crawler-dialog'

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

const FOOT = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: tokens.space[8],
} satisfies CSSProperties

const FOOT_ONE = { display: 'flex', justifyContent: 'flex-end' } satisfies CSSProperties

const STACK_12 = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

const ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space[8],
} satisfies CSSProperties

const CONTRIBUTE_LABEL = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.xs,
  lineHeight: 1 / 0.75,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.capsSnug,
  color: tokens.color.ink,
} satisfies CSSProperties

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
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.caps,
  color: tokens.color.ink,
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
  /** Injectable store — defaults to useEntityStore. */
  store: typeof useEntityStore
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
  store: typeof useEntityStore
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Pay Upkeep + failed-Upkeep Deterioration (p.218-219)
// ---------------------------------------------------------------------------

/**
 * The Deterioration readout: the rolled row of the Crawler Deterioration table
 * (p.219), verbatim, then what was applied — the SP left and the Bay the
 * random pick landed on — so the readout and the book cannot disagree.
 */
function describeDeterioration(effect: DeteriorationEffect, bayName: string | null): string {
  const table = SalvageUnionReference.RollTables.getByName('Crawler Deterioration')?.table
  const row = resultForTable(table, effect.roll)
  const applied = [
    row.success ? plainTraitText(row.result.value) : '',
    bayName === null ? '' : `${bayName} is Damaged.`,
    effect.spLoss > 0 ? `SP now ${effect.nextSP}.` : '',
    effect.spLoss > 0 && effect.nextSP === 0 ? 'At 0 SP, roll the Crawler Damage Table.' : '',
  ]
  return `Deterioration ${effect.roll}: ${applied.filter(Boolean).join(' ')}`
}

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
      title="Pay Upkeep"
      subtitle={`${DOWNTIME_UPKEEP_SCRAP}× Tech ${tl} Scrap per Downtime`}
      maxWidth={DIALOG_WIDTH}
    >
      <div style={BODY}>
        <p style={MUTED}>
          Upkeep costs {DOWNTIME_UPKEEP_SCRAP} Scrap of Tech {tl} or higher each Downtime. Paying it
          credits the Upgrade Pool in full; failing to pay rolls the Crawler Deterioration Table.
        </p>
        <p style={TEXT}>
          Pool holds <strong>{available}</strong> scrap at Tech {tl}+.
        </p>

        {!done && shortfall > 0 && (
          <FieldError>
            The pool is {shortfall} scrap short — Upkeep fails unless the table rules otherwise.
            Trade Scrap between Tech Levels at the Trading Bay, or roll Deterioration.
          </FieldError>
        )}

        {result && (
          <p role="status" style={TEXT}>
            {result}
          </p>
        )}
        {choosePrompt && (
          <FieldError>
            Choose a Bay and mark it Damaged using its status badge on the sheet.
          </FieldError>
        )}

        <div style={FOOT}>
          <Button variant="ghost" size="compact" onClick={onClose}>
            {done ? 'Done' : 'Cancel'}
          </Button>
          {!done && shortfall === 0 && (
            <Button
              variant="primary"
              size="compact"
              onClick={() => {
                void handlePay()
              }}
            >
              Pay Upkeep
            </Button>
          )}
          {!done && shortfall > 0 && (
            <Button
              variant="danger"
              size="compact"
              onClick={() => {
                void handleDeterioration()
              }}
            >
              Roll Deterioration (d20)
            </Button>
          )}
        </div>
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
      title="Upgrade Crawler"
      maxWidth={DIALOG_WIDTH}
    >
      <div style={BODY}>
        {quote ? (
          <div style={STACK_12}>
            <p>
              Upgrading from Tech {quote.fromTl} to Tech {quote.toTl} consumes{' '}
              <strong>{quote.cost}</strong> from the Upgrade Pool (currently{' '}
              <strong>{upgradePool}</strong>). Damaged Bays are repaired during the upgrade; Upkeep
              rises to {DOWNTIME_UPKEEP_SCRAP}× Tech {quote.toTl} Scrap.
            </p>
            {!quote.affordable && (
              <FieldError>
                The Upgrade Pool is {quote.cost - upgradePool} short. Pay Upkeep or contribute scrap
                below to fill it.
              </FieldError>
            )}
            <div style={ROW}>
              <span style={CONTRIBUTE_LABEL}>Contribute scrap (Tech {tl}+)</span>
              <Stat
                orientation="horizontal"
                size="compact"
                label="Scrap"
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
                title={`Move ${contribution} scrap (Tech ${tl} or higher) from the pool into the Upgrade Pool`}
                onClick={() => {
                  void handleContribute()
                }}
              >
                Add to Upgrade Pool
              </Button>
            </div>
            <p style={SMALL}>
              Pool holds {contributable} scrap at Tech {tl}+.
            </p>
          </div>
        ) : (
          <p>
            Tech 6 is the highest level of Union Crawler — it cannot be upgraded further (p.218).
          </p>
        )}
        <div style={FOOT}>
          <Button variant="ghost" size="compact" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="compact"
            onClick={() => {
              void handleUpgrade()
            }}
            disabled={!quote?.affordable}
          >
            {quote ? `Upgrade to Tech ${quote.toTl}` : 'Upgrade'}
          </Button>
        </div>
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
      dispatch({ type: 'converted', note: 'The pool no longer covers that trade.' })
      return
    }
    await storeState.update('crawler', crawler.id, { scrapPool: result.pool }, LIVE_SHEET_TXN)
    dispatch({
      type: 'converted',
      note: `Traded ${count}× T${fromTl} for ${result.toCount}× T${toTl}.`,
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
      title="Trading Bay"
      subtitle={`Scrap exchange & Downtime sourcing · Tech ${tl} crawler`}
      maxWidth={DIALOG_WIDTH}
    >
      <div style={BODY}>
        {!gate.present && <EmptyState variant="quiet" body="This crawler has no Trading Bay." />}
        {gate.damaged && (
          <FieldError>
            The Trading Bay is Damaged — Scrap cannot be traded and the Trading Bay Table cannot be
            rolled until it is repaired to Intact (p.223).
          </FieldError>
        )}

        {gate.operational && (
          <>
            <div>
              <Slab
                variant="solid"
                label="Trade Scrap"
                count="fixed equal-value rates · no bartering"
              />
              <div style={PICKERS}>
                <label htmlFor="trade-from-tl" style={PICKER_LABEL}>
                  From
                  <Select
                    id="trade-from-tl"
                    style={PICKER}
                    value={fromTl}
                    onChange={(e) => dispatch({ type: 'pickFrom', tl: Number(e.target.value) })}
                  >
                    {SCRAP_TLS.map((t) => (
                      <option key={t} value={t}>
                        Tech {t} ({scrapPoolBucket(pool, t)} in pool)
                      </option>
                    ))}
                  </Select>
                </label>
                <label htmlFor="trade-to-tl" style={PICKER_LABEL}>
                  To
                  <Select
                    id="trade-to-tl"
                    style={PICKER}
                    value={toTl}
                    onChange={(e) => dispatch({ type: 'pickTo', tl: Number(e.target.value) })}
                  >
                    {SCRAP_TLS.map((t) => (
                      <option key={t} value={t}>
                        Tech {t}
                      </option>
                    ))}
                  </Select>
                </label>
                <span style={QTY}>
                  <Stat
                    orientation="horizontal"
                    size="compact"
                    label="Qty"
                    value={count}
                    min={step}
                    step={step}
                    mode="edit"
                    stepperLabel={`trade amount by ${step}`}
                    onChange={(next) => dispatch({ type: 'setCount', count: next })}
                  />
                </span>
              </div>
              <div style={ACTION_ROW}>
                <p style={TEXT_TIGHT} data-testid="trade-preview">
                  {fromTl === toTl
                    ? 'Pick two different Tech Levels.'
                    : toCount === null
                      ? 'Not an exact trade — the Trading Bay never makes change.'
                      : `${count}× T${fromTl} → ${toCount}× T${toTl}`}
                </p>
                <Button
                  size="compact"
                  variant="primary"
                  disabled={!convertible}
                  title={
                    bucket < count
                      ? `The pool only holds ${bucket}× T${fromTl}.`
                      : 'Apply the exchange to the pool'
                  }
                  onClick={() => {
                    void handleConvert()
                  }}
                >
                  Trade
                </Button>
              </div>
              {convertNote && (
                <p role="status" style={TEXT_AFTER}>
                  {convertNote}
                </p>
              )}
            </div>

            <div>
              <Slab
                variant="solid"
                label="Source Wares"
                count={`once per Downtime · wares are Tech ${tradingSourceTl(tl)}`}
              />
              <p style={MUTED}>
                Once per Downtime, roll to see what the wastelanders brought to trade — always one
                Tech Level above the crawler. Buying costs an item&rsquo;s Salvage Value in Scrap of
                its Tech Level.
              </p>
              <div style={ACTION_ROW}>
                <Button size="compact" variant="primary" onClick={handleAvailabilityRoll}>
                  Roll Availability (d20)
                </Button>
                {availability && (
                  <p role="status" style={TEXT_TIGHT}>
                    Rolled {availability.roll}:{' '}
                    {TRADING_AVAILABILITY_LABEL[availability.availability]}
                    {availability.availability !== 'nothing' && ` (Tech ${availability.sourceTl})`}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <div style={FOOT_ONE}>
          <Button variant="ghost" size="compact" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
