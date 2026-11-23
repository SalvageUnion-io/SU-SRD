/**
 * PlayDowntimeCraftTrade — solo Craft · Trade inside Downtime (r6 D4): the
 * crawler's Crafting Bay and Trading Bay with their controls, opened as the
 * row's body, never a trip to the crawler's sheet. Each unit's sheet is a tap
 * away on the screen (`useOpenSheet`, play.md §18) and Close folds the panel
 * back into its row. Loaded only once Open is pressed (the sheet route's
 * bundle budget).
 *
 *  - **Crafting Bay** (r6 D5, Core Book p.222): find a System or Module of the
 *    crawler's Tech Level or lower; Craft spends its Salvage Value in Scrap of
 *    its Tech Level or higher from the pool, then mounts it on the mech or
 *    stores it in the hold, and lands on the Feed. Short, it says how much is
 *    missing and spends nothing.
 *  - **Scrap Pool** heads it (r8 D1): the crawler's Scrap by Tech Level, and a
 *    Craft or Buy the pool cannot pay is off, saying how much is short.
 *  - **Trading Bay** (r6 D6, p.223): the availability roll picks the wares at
 *    random at the rolled Tech Level, each with Choose instead and a Buy that
 *    spends the Scrap and stores it; Trade Scrap opens the fixed-rate exchange
 *    (`CrawlerEconomyControl`, the sheet's own dialog).
 *
 * A damaged bay says so in place of its controls (p.222, p.223). Inside the
 * row's body everything is plain content (N3, play.md §12).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { CrawlerEconomyControl } from '../build/sheet/CrawlerEconomyControl'
import { Button, capsLabel, Mention, SearchField, Stat, toast } from '../components/index'
import {
  bayGate,
  performTradingRoll,
  TRADING_AVAILABILITY_LABEL,
} from '../lib/rules/crawlerEconomy'
import { runWrite } from '../lib/runWrite'
import { componentsCopy } from '../messages/components'
import { playCopy } from '../messages/play'
import { playDowntimeCopy } from '../messages/play-downtime'
import { PLAY_TXN, PLAY_UNDO } from '../replica/provenance'
import { useUnits } from '../replica/units'
import type { Crafted, Ware } from './craftTrade.model'
import {
  craftUpdates,
  findCraftables,
  shortOf,
  spendFor,
  storePatch,
  TRADING_BAY_TABLE,
  tradeOffers,
  uncraftUpdates,
  waresAt,
} from './craftTrade.model'
import { recordPlayChange } from './playRolls.model'
import { poolChips } from './scrapPool.model'
import type { TradeRoll } from './tradeRoll.model'
import { useTradeRolls } from './tradeRoll.model'
import { useOpenSheet } from './useOpenSheet'
import type { PlayActions } from './usePlayActions'

const HEAD = capsLabel()

type Props = {
  crawler: Crawler
  mech: Mech | null
  store: PlayActions['store']
  rollFor: PlayActions['rollFor']
  canWrite: boolean
  onClose: () => void
}

export function PlayDowntimeCraftTrade({
  crawler,
  mech,
  store,
  rollFor,
  canWrite,
  onClose,
}: Props) {
  const setSheet = useOpenSheet()
  const crafting = bayGate(crawler, 'crafting-bay')
  return (
    <div className="su-play-resolve">
      <ScrapPoolLine crawler={crawler} />
      <p>
        <Button
          size="mini"
          onClick={() => setSheet({ kind: 'crawler', id: crawler.id, name: crawler.name })}
        >
          {playCopy('craftSheetOf', { name: crawler.name })}
        </Button>{' '}
        {mech && (
          <Button
            size="mini"
            onClick={() => setSheet({ kind: 'mech', id: mech.id, name: mech.name })}
          >
            {playCopy('craftSheetOf', { name: mech.name })}
          </Button>
        )}{' '}
        <Button size="mini" onClick={onClose}>
          {playCopy('craftBackToTheStep')}
        </Button>
      </p>
      <p className={HEAD}>{playCopy('craftingBay')}</p>
      {crafting.damaged ? (
        <p className="su-play-act__need">{playCopy('craftingBayDamaged')}</p>
      ) : (
        <CraftingBay crawler={crawler} mech={mech} store={store} canWrite={canWrite} />
      )}
      <p className={HEAD}>{playCopy('tradingBay')}</p>
      <TradingBaySection crawler={crawler} store={store} rollFor={rollFor} canWrite={canWrite} />
    </div>
  )
}

type TradeProps = Pick<Props, 'crawler' | 'store' | 'rollFor' | 'canWrite'>

/**
 * The Trade step's body, solo with a crawler (r8 D3, SB8-09): the roll the
 * step names, here where it is named, with the Scrap Pool it spends from. The
 * roll is the one Craft · Trade shows (`tradeRoll.model.ts`), so it is made once.
 */
export function TradeStepBay(props: TradeProps) {
  return (
    <div className="su-play-resolve">
      <ScrapPoolLine crawler={props.crawler} />
      <TradingBaySection {...props} />
    </div>
  )
}

/** The Trading Bay: its roll and wares, then Trade Scrap; damaged, why not (p.223). */
function TradingBaySection({ crawler, store, rollFor, canWrite }: TradeProps) {
  const [exchange, setExchange] = useState(false)
  if (bayGate(crawler, 'trading-bay').damaged)
    return <p className="su-play-act__need">{playCopy('tradingBayDamaged')}</p>
  return (
    <>
      <TradingBay crawler={crawler} store={store} rollFor={rollFor} canWrite={canWrite} />
      <Button size="mini" disabled={!canWrite} onClick={() => setExchange(true)}>
        {playCopy('tradeScrap')}
      </Button>
      <CrawlerEconomyControl
        crawler={crawler}
        store={useUnits}
        open={exchange ? 'trade' : null}
        onClose={() => setExchange(false)}
      />
    </>
  )
}

/**
 * The panel's head: the crawler's Scrap Pool by Tech Level, so every price
 * below is read against it (r8 D1, SB8-10).
 */
function ScrapPoolLine({ crawler }: { crawler: Crawler }) {
  const chips = poolChips(crawler.scrapPool)
  return (
    <ul className="su-play-dt-lines" aria-label={playDowntimeCopy('scrapPool')}>
      <li className="su-play-dt-line">
        <strong className="su-play-dt-line__label">{playDowntimeCopy('scrapPool')}</strong>
        <span className="su-play-dt-line__chips">
          {chips.length === 0 ? (
            <Stat size="mini" label={playDowntimeCopy('scrapPoolNone')} />
          ) : (
            chips.map((chip) => (
              <Stat key={chip.label} size="mini" label={chip.label} value={chip.value} />
            ))
          )}
        </span>
      </li>
    </ul>
  )
}

/** A price the pool cannot pay: the press is off and this says why (r8 D1). */
function ShortNeed({ short, tl }: { short: number; tl: number }) {
  return short > 0 ? (
    <span className="su-play-act__need">{playDowntimeCopy('shortOfScrap', { short, tl })}</span>
  ) : null
}

/** What a spend came to, in words: what was spent, or how much is missing. */
function shortText(short: number, tl: number) {
  return playCopy('craftShort', { short, tl })
}

function WareLine({ ware, children }: { ware: Ware; children: ReactNode }) {
  return (
    <li className="su-play-dt-line">
      <strong className="su-play-dt-line__label">
        <Mention entityRef={ware.ref}>{ware.name}</Mention>
      </strong>
      <span className="su-play-dt-line__chips">
        <Stat size="mini" label={playCopy('techShort', { tl: ware.tl })} />
        <Stat
          size="mini"
          label={playCopy('craftCost')}
          value={`${ware.salvageValue} T${ware.tl}+`}
        />
      </span>
      {children}
    </li>
  )
}

/** The Crafting Bay's search and Craft; the crawler sheet's Crafting Bay opens it too (r7 D7). */
export function CraftingBay({
  crawler,
  mech,
  store,
  canWrite,
}: Pick<Props, 'crawler' | 'mech' | 'store' | 'canWrite'>) {
  const [query, setQuery] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const found = findCraftables(crawler.techLevel, query)
  const pool = crawler.scrapPool ?? {}

  function craft(ware: Ware, install: boolean) {
    const fresh = store.get('crawler', crawler.id) ?? crawler
    const freshMech = mech ? (store.get('mech', mech.id) ?? mech) : null
    // The Scrap and the item are one change, so one Undo takes both back (r7 D6).
    const done = craftUpdates(fresh, freshMech, ware, install)
    if (!done.ok) {
      setNote(shortText(done.short, done.tl))
      return
    }
    runWrite(
      () => store.transfer({ updates: done.updates }, PLAY_TXN),
      () => {
        const where =
          done.crafted.mechId !== null && freshMech ? freshMech.name : playCopy('craftStorageBay')
        const said = playCopy('crafted', {
          name: ware.name,
          scrap: ware.salvageValue,
          tl: ware.tl,
          where,
        })
        recordPlayChange(said)
        setNote(said)
        toast(said, {
          id: `craft:${crawler.id}`,
          action: { label: componentsCopy('undo'), onClick: () => uncraft(done.crafted) },
        })
      }
    )
  }

  /** The craft's Undo: its Scrap back in the pool and the item off, as one batch. */
  function uncraft(crafted: Crafted) {
    const now = store.get('crawler', crawler.id) ?? crawler
    const onMech = crafted.mechId === null ? null : store.get('mech', crafted.mechId)
    runWrite(
      () => store.transfer({ updates: uncraftUpdates(now, onMech, crafted) }, PLAY_UNDO),
      () => {
        const said = playDowntimeCopy('uncrafted', { name: crafted.ware.name })
        recordPlayChange(said)
        setNote(said)
      }
    )
  }

  return (
    <>
      <SearchField
        type="search"
        placeholder={playCopy('craftFind')}
        aria-label={playCopy('craftFind')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {found.length > 0 && (
        <ul className="su-play-dt-lines" aria-label={playCopy('craftables')}>
          {found.map((ware) => {
            const short = shortOf(pool, ware)
            const off = !canWrite || short > 0
            return (
              <WareLine key={`${ware.kind}:${ware.slug}`} ware={ware}>
                <ShortNeed short={short} tl={ware.tl} />
                {mech && ware.kind !== 'chassis' && (
                  <Button size="mini" disabled={off} onClick={() => craft(ware, true)}>
                    {playCopy('craftOnto', { name: mech.name })}
                  </Button>
                )}
                <Button size="mini" disabled={off} onClick={() => craft(ware, false)}>
                  {playCopy('craftAndStore')}
                </Button>
              </WareLine>
            )
          })}
        </ul>
      )}
      {note && (
        <p className="su-play-resolve__note" aria-live="polite">
          {note}
        </p>
      )}
    </>
  )
}

function TradingBay({ crawler, store, rollFor, canWrite }: TradeProps) {
  const shared = useTradeRolls((s) => s.byCrawler[crawler.id])
  const put = useTradeRolls((s) => s.put)
  const rolled = shared?.rolled ?? null
  const offers = shared?.offers ?? []
  const bought = new Set(shared?.bought ?? [])
  const [choosing, setChoosing] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)
  /** The shared roll with `change` made to it, read fresh. */
  const update = (change: (was: TradeRoll) => Partial<TradeRoll>) => {
    const was = useTradeRolls.getState().byCrawler[crawler.id]
    if (was) put(crawler.id, { ...was, ...change(was) })
  }

  async function roll() {
    const die = await rollFor(TRADING_BAY_TABLE, playCopy('tradingBay'))
    const result = performTradingRoll({ crawlerTl: crawler.techLevel, roll: die })
    put(crawler.id, {
      rolled: {
        roll: result.roll,
        label: TRADING_AVAILABILITY_LABEL[result.availability],
        tl: result.sourceTl,
      },
      // What is for sale is picked at random at the rolled Tech Level (p.223).
      offers: tradeOffers(result.availability, result.sourceTl, (n) =>
        Math.ceil(Math.random() * n)
      ),
      bought: [],
    })
  }

  function buy(ware: Ware) {
    const fresh = store.get('crawler', crawler.id) ?? crawler
    const spent = spendFor(fresh.scrapPool ?? {}, ware)
    if (!spent.ok) {
      setNote(shortText(spent.short, spent.tl))
      return
    }
    runWrite(
      () => store.update('crawler', crawler.id, storePatch(fresh, spent.pool, ware), PLAY_TXN),
      () => {
        const said = playCopy('bought', { name: ware.name, scrap: ware.salvageValue, tl: ware.tl })
        recordPlayChange(said)
        update((was) => ({ bought: [...was.bought, `${ware.kind}:${ware.slug}`] }))
        setNote(said)
      }
    )
  }

  const choices =
    choosing === null ? [] : waresAt(offers[choosing]?.kind ?? 'system', rolled?.tl ?? 1)
  return (
    <>
      {rolled === null ? (
        <Button size="mini" disabled={!canWrite} onClick={() => void roll()}>
          {playCopy('rollAvailability')}
        </Button>
      ) : (
        <p className="su-play-resolve__note" aria-live="polite">
          {rolled.roll} · {rolled.label}
        </p>
      )}
      {offers.length > 0 && (
        <ul className="su-play-dt-lines" aria-label={playCopy('forSale')}>
          {offers.map((ware, i) => {
            const sold = bought.has(`${ware.kind}:${ware.slug}`)
            const short = shortOf(crawler.scrapPool ?? {}, ware)
            return (
              <WareLine key={`${ware.kind}:${ware.slug}`} ware={ware}>
                {sold ? (
                  <Stat size="mini" label={playCopy('boughtState')} />
                ) : (
                  <>
                    <Button size="mini" onClick={() => setChoosing(choosing === i ? null : i)}>
                      {playCopy('chooseInstead')}
                    </Button>
                    <ShortNeed short={short} tl={ware.tl} />
                    <Button size="mini" disabled={!canWrite || short > 0} onClick={() => buy(ware)}>
                      {playCopy('buyFor', { scrap: ware.salvageValue, tl: ware.tl })}
                    </Button>
                  </>
                )}
              </WareLine>
            )
          })}
        </ul>
      )}
      {choosing !== null && (
        <ul className="su-play-dt-lines" aria-label={playCopy('chooseInstead')}>
          {choices.map((ware) => (
            <li key={ware.slug} className="su-play-dt-line">
              <Button
                size="mini"
                onClick={() => {
                  update((was) => ({
                    offers: was.offers.map((w, i) => (i === choosing ? ware : w)),
                  }))
                  setChoosing(null)
                }}
              >
                {ware.name}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {note && (
        <p className="su-play-resolve__note" aria-live="polite">
          {note}
        </p>
      )}
    </>
  )
}
