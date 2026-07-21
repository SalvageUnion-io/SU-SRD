/**
 * CrawlerEconomyControl — the crawler-economy actions behind the hero's
 * UPKEEP / UPGRADE / TRADE spec lozenges (design-review R-4; Core Book
 * p.218-223): Pay Upkeep (with the failed-Upkeep Deterioration roll),
 * Upgrade Crawler, the fixed-rate Scrap exchange, and the Trading Bay
 * availability roll.
 *
 * ADR-007 automation boundary, following the HeatCheckControl pattern:
 * deterministic bookkeeping auto-applies — the Upkeep draw + Upgrade-Pool
 * credit, the Deterioration SP loss and its "chosen at random" Bay damage,
 * the upgrade's TL bump / pool spend / bay repairs, and the Scrap exchange.
 * The Deterioration 6-10 band (the PLAYER chooses a Bay) only shows an
 * advisory; the availability roll is informational — buying the sourced
 * wares stays a table call.
 *
 * Rolls are ephemeral (nothing persists but the applied bookkeeping), so
 * snapshots have nothing to show; the control mounts only on editable
 * sheets. Pure logic lives in lib/rules/crawlerEconomy.ts (injectable d20).
 */

import { useState } from 'react'
import { Button, ModalShell, Select, Slab, Stat, FieldError } from 'component-lib'

import { scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import {
  TRADING_AVAILABILITY_LABEL,
  UPKEEP_SCRAP,
  bayGate,
  contributeToUpgradePool,
  convertScrap,
  convertedCount,
  crawlerUpgradeQuote,
  exchangeStep,
  payUpkeep,
  performDeterioration,
  performTradingRoll,
  poolAvailableAtOrAbove,
  tradingSourceTl,
  upkeepShortfall,
} from '../../lib/rules/crawlerEconomy'
import type { DeteriorationEffect, TradingRollResult } from '../../lib/rules/crawlerEconomy'
import { crawlerMaxSP } from '../../lib/rules/derivedStats'
import { defaultRoll } from '../../lib/rules/heatCheck'
import type { Roll } from '../../lib/rules/heatCheck'
import type { Crawler } from '../../lib/schemas/crawler'
import type { useEntityStore } from '../../stores/entityStore'
import { freshEntity } from './controlPrimitives'

/** Which economy dialog is open (the lozenge that was clicked). */
export type CrawlerEconomyDialog = 'upkeep' | 'upgrade' | 'trade'

const TRADING_BAY = 'Trading Bay'
const SCRAP_TLS = [1, 2, 3, 4, 5, 6] as const

type CrawlerEconomyControlProps = {
  crawler: Crawler
  /** Injectable store — defaults to useEntityStore. */
  store: typeof useEntityStore
  /** The open dialog; null renders nothing. */
  open: CrawlerEconomyDialog | null
  onClose: () => void
  /** Injectable d20 / random-Bay roller — defaults to a randsum-backed roll. */
  roll?: Roll
}

export function CrawlerEconomyControl({
  crawler,
  store,
  open,
  onClose,
  roll = defaultRoll,
}: CrawlerEconomyControlProps) {
  // Each dialog mounts only while open so its roll/result state resets.
  return (
    <>
      {open === 'upkeep' && (
        <UpkeepDialog crawler={crawler} store={store} roll={roll} onClose={onClose} />
      )}
      {open === 'upgrade' && <UpgradeDialog crawler={crawler} store={store} onClose={onClose} />}
      {open === 'trade' && (
        <TradeDialog crawler={crawler} store={store} roll={roll} onClose={onClose} />
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

function describeDeterioration(effect: DeteriorationEffect, bayName: string | null): string {
  const head = `Deterioration ${effect.roll}: `
  switch (effect.outcome) {
    case 'safe':
      return `${head}the crawler chugs along for now — no effect.`
    case 'lose-sp':
      return `${head}the crawler loses ${effect.spLoss} SP (now ${effect.nextSP}).${
        effect.nextSP === 0 ? ' At 0 SP, roll the Crawler Damage Table.' : ''
      }`
    case 'choose-bay':
      return `${head}a Bay of your choice becomes Damaged and inoperable.`
    case 'random-bay':
      return `${head}${bayName ?? 'a random Bay'} is Damaged and inoperable until repaired.`
    case 'sp-and-random-bay':
      return `${head}the crawler loses ${effect.spLoss} SP (now ${effect.nextSP}) and ${
        bayName ?? 'a random Bay'
      } is Damaged until repaired.${effect.nextSP === 0 ? ' At 0 SP, roll the Crawler Damage Table.' : ''}`
  }
}

function UpkeepDialog({ crawler, store, roll, onClose }: DialogProps & { roll: Roll }) {
  const storeState = store()
  const [result, setResult] = useState<string | null>(null)
  const [choosePrompt, setChoosePrompt] = useState(false)
  const [done, setDone] = useState(false)

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
      setResult('The pool can no longer cover Upkeep — roll Deterioration instead.')
      return
    }
    const nextUpgradePool = (fresh.upgradePool ?? 0) + payment.upgradeCredit
    await storeState.update('crawler', crawler.id, {
      scrapPool: payment.pool,
      upgradePool: nextUpgradePool,
    })
    const drawText = payment.draws.map((d) => `${d.count}× T${d.tl}`).join(' + ')
    setResult(
      `Paid ${UPKEEP_SCRAP} Scrap (${drawText}) — Upgrade Pool now ${nextUpgradePool}${
        quote ? ` of ${quote.cost}` : ''
      }.`
    )
    setDone(true)
  }

  /**
   * Failed Upkeep: roll the Deterioration Table. SP loss and the "chosen at
   * random" Bay damage auto-apply; the 6-10 band leaves the Bay pick to the
   * player (ADR-007).
   */
  async function handleDeterioration() {
    const fresh = freshEntity(storeState, 'crawler', crawler)
    const bays = fresh.crawlerBays ?? []
    const maxSP = crawlerMaxSP(fresh)
    const currentSP = Math.min(fresh.currentSP ?? maxSP, maxSP)
    const effect = performDeterioration({ currentSP, bayCount: bays.length, roll })

    if (effect.spLoss > 0) {
      await storeState.update('crawler', crawler.id, { currentSP: effect.nextSP })
    }
    let bayName: string | null = null
    if (effect.randomBayIndex !== null) {
      const entry = bays[effect.randomBayIndex]
      if (entry) {
        await storeState.updateCrawlerBay(
          crawler.id,
          entry.bayRef,
          { condition: 'damaged' },
          effect.randomBayIndex
        )
        bayName = resolveCrawlerBay(entry.bayRef)?.name ?? entry.bayRef
      }
    }
    setChoosePrompt(effect.requiresPlayerChoice)
    setResult(describeDeterioration(effect, bayName))
    setDone(true)
  }

  return (
    <ModalShell
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Pay Upkeep"
      subtitle={`${UPKEEP_SCRAP}× Tech ${tl} Scrap per Downtime`}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4 bg-paper p-5">
        <p className="font-body text-sm text-wk-muted">
          Upkeep costs {UPKEEP_SCRAP} Scrap of Tech {tl} or higher each Downtime. Paying it credits
          the Upgrade Pool in full; failing to pay rolls the Crawler Deterioration Table.
        </p>
        <p className="font-body text-sm text-ink">
          Pool holds <strong>{available}</strong> scrap at Tech {tl}+.
        </p>

        {!done && shortfall > 0 && (
          <FieldError>
            The pool is {shortfall} scrap short — Upkeep fails unless the table rules otherwise.
            Trade Scrap between Tech Levels at the Trading Bay, or roll Deterioration.
          </FieldError>
        )}

        {result && (
          <p role="status" className="font-body text-sm text-ink">
            {result}
          </p>
        )}
        {choosePrompt && (
          <FieldError>
            Choose a Bay and mark it Damaged using its status badge on the sheet.
          </FieldError>
        )}

        <div className="flex justify-end gap-2">
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
    await storeState.update('crawler', crawler.id, {
      scrapPool: result.pool,
      upgradePool: (fresh.upgradePool ?? 0) + contribution,
    })
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
    await storeState.update('crawler', crawler.id, patch)
    onClose()
  }

  return (
    <ModalShell
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Upgrade Crawler"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4 bg-paper p-5">
        {quote ? (
          <div className="flex flex-col gap-3">
            <p>
              Upgrading from Tech {quote.fromTl} to Tech {quote.toTl} consumes{' '}
              <strong>{quote.cost}</strong> from the Upgrade Pool (currently{' '}
              <strong>{upgradePool}</strong>). Damaged Bays are repaired during the upgrade; Upkeep
              rises to {UPKEEP_SCRAP}× Tech {quote.toTl} Scrap.
            </p>
            {!quote.affordable && (
              <FieldError>
                The Upgrade Pool is {quote.cost - upgradePool} short. Pay Upkeep or contribute scrap
                below to fill it.
              </FieldError>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-cond text-xs font-bold uppercase tracking-caps-snug text-ink">
                Contribute scrap (Tech {tl}+)
              </span>
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
            <p className="text-xs">
              Pool holds {contributable} scrap at Tech {tl}+.
            </p>
          </div>
        ) : (
          <p>
            Tech 6 is the highest level of Union Crawler — it cannot be upgraded further (p.218).
          </p>
        )}
        <div className="flex justify-end gap-2">
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

function TradeDialog({ crawler, store, roll, onClose }: DialogProps & { roll: Roll }) {
  const storeState = store()
  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  const gate = bayGate(crawler, TRADING_BAY)
  const pool = crawler.scrapPool ?? {}

  const [fromTl, setFromTl] = useState(1)
  const [toTl, setToTl] = useState(2)
  const [count, setCount] = useState(exchangeStep(1, 2))
  const [convertNote, setConvertNote] = useState<string | null>(null)
  const [availability, setAvailability] = useState<TradingRollResult | null>(null)

  const step = fromTl === toTl ? 1 : exchangeStep(fromTl, toTl)
  const toCount = convertedCount(fromTl, count, toTl)
  const bucket = scrapPoolBucket(pool, fromTl)
  const convertible =
    gate.operational && fromTl !== toTl && toCount !== null && count > 0 && bucket >= count

  function pickFrom(next: number) {
    setFromTl(next)
    setCount(next === toTl ? 1 : exchangeStep(next, toTl))
  }
  function pickTo(next: number) {
    setToTl(next)
    setCount(fromTl === next ? 1 : exchangeStep(fromTl, next))
  }

  /** Apply the fixed equal-value exchange to the pool buckets (auto-applies). */
  async function handleConvert() {
    const fresh = freshEntity(storeState, 'crawler', crawler)
    const result = convertScrap(fresh.scrapPool ?? {}, fromTl, count, toTl)
    if (!result) {
      setConvertNote('The pool no longer covers that trade.')
      return
    }
    await storeState.update('crawler', crawler.id, { scrapPool: result.pool })
    setConvertNote(`Traded ${count}× T${fromTl} for ${result.toCount}× T${toTl}.`)
  }

  /** Once per Downtime (honor system) — what the wastelanders brought. */
  function handleAvailabilityRoll() {
    setAvailability(performTradingRoll({ crawlerTl: tl, roll }))
  }

  return (
    <ModalShell
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Trading Bay"
      subtitle={`Scrap exchange & Downtime sourcing · Tech ${tl} crawler`}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4 bg-paper p-5">
        {!gate.present && (
          <p className="font-body text-sm text-wk-muted">
            No Trading Bay is installed on this crawler.
          </p>
        )}
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
              <div className="flex flex-wrap items-end gap-3">
                <label
                  htmlFor="trade-from-tl"
                  className="flex flex-col gap-1 font-cond text-label font-bold uppercase tracking-caps text-ink"
                >
                  From
                  <Select
                    id="trade-from-tl"
                    className="px-2 py-1.5"
                    value={fromTl}
                    onChange={(e) => pickFrom(Number(e.target.value))}
                  >
                    {SCRAP_TLS.map((t) => (
                      <option key={t} value={t}>
                        Tech {t} ({scrapPoolBucket(pool, t)} in pool)
                      </option>
                    ))}
                  </Select>
                </label>
                <label
                  htmlFor="trade-to-tl"
                  className="flex flex-col gap-1 font-cond text-label font-bold uppercase tracking-caps text-ink"
                >
                  To
                  <Select
                    id="trade-to-tl"
                    className="px-2 py-1.5"
                    value={toTl}
                    onChange={(e) => pickTo(Number(e.target.value))}
                  >
                    {SCRAP_TLS.map((t) => (
                      <option key={t} value={t}>
                        Tech {t}
                      </option>
                    ))}
                  </Select>
                </label>
                <span className="inline-flex pb-1">
                  <Stat
                    orientation="horizontal"
                    size="compact"
                    label="Qty"
                    value={count}
                    min={step}
                    step={step}
                    mode="edit"
                    stepperLabel={`trade amount by ${step}`}
                    onChange={setCount}
                  />
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="m-0 font-body text-sm text-ink" data-testid="trade-preview">
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
                <p role="status" className="mt-2 font-body text-sm text-ink">
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
              <p className="font-body text-sm text-wk-muted">
                Once per Downtime, roll to see what the wastelanders brought to trade — always one
                Tech Level above the crawler. Buying costs an item&rsquo;s Salvage Value in Scrap of
                its Tech Level.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button size="compact" variant="primary" onClick={handleAvailabilityRoll}>
                  Roll Availability (d20)
                </Button>
                {availability && (
                  <p role="status" className="m-0 font-body text-sm text-ink">
                    Rolled {availability.roll}:{' '}
                    {TRADING_AVAILABILITY_LABEL[availability.availability]}
                    {availability.availability !== 'nothing' && ` (Tech ${availability.sourceTl})`}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" size="compact" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
