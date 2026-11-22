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
import { Button, capsLabel, Mention, SearchField, Stat } from '../components/index'
import {
  bayGate,
  performTradingRoll,
  TRADING_AVAILABILITY_LABEL,
} from '../lib/rules/crawlerEconomy'
import { runWrite } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { PLAY_TXN } from '../replica/provenance'
import { useUnits } from '../replica/units'
import type { Ware } from './craftTrade.model'
import {
  findCraftables,
  installPatch,
  spendFor,
  storePatch,
  TRADING_BAY_TABLE,
  tradeOffers,
  waresAt,
} from './craftTrade.model'
import { recordPlayChange } from './playRolls.model'
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
  const [exchange, setExchange] = useState(false)
  const crafting = bayGate(crawler, 'crafting-bay')
  const trading = bayGate(crawler, 'trading-bay')
  return (
    <div className="su-play-resolve">
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
      {trading.damaged ? (
        <p className="su-play-act__need">{playCopy('tradingBayDamaged')}</p>
      ) : (
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
      )}
    </div>
  )
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

function CraftingBay({
  crawler,
  mech,
  store,
  canWrite,
}: Pick<Props, 'crawler' | 'mech' | 'store' | 'canWrite'>) {
  const [query, setQuery] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const found = findCraftables(crawler.techLevel, query)

  function craft(ware: Ware, install: boolean) {
    const fresh = store.get('crawler', crawler.id) ?? crawler
    const spent = spendFor(fresh.scrapPool ?? {}, ware)
    if (!spent.ok) {
      setNote(shortText(spent.short, spent.tl))
      return
    }
    const freshMech = mech ? (store.get('mech', mech.id) ?? mech) : null
    const mount = install && freshMech ? installPatch(freshMech, ware) : null
    const crawlerPatch = mount ? { scrapPool: spent.pool } : storePatch(fresh, spent.pool, ware)
    runWrite(
      () => store.update('crawler', crawler.id, crawlerPatch, PLAY_TXN),
      () => {
        if (mount && freshMech) runWrite(() => store.update('mech', freshMech.id, mount, PLAY_TXN))
        const where = mount && freshMech ? freshMech.name : playCopy('craftStorageBay')
        const said = playCopy('crafted', {
          name: ware.name,
          scrap: ware.salvageValue,
          tl: ware.tl,
          where,
        })
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
          {found.map((ware) => (
            <WareLine key={`${ware.kind}:${ware.slug}`} ware={ware}>
              {mech && ware.kind !== 'chassis' && (
                <Button size="mini" disabled={!canWrite} onClick={() => craft(ware, true)}>
                  {playCopy('craftOnto', { name: mech.name })}
                </Button>
              )}
              <Button size="mini" disabled={!canWrite} onClick={() => craft(ware, false)}>
                {playCopy('craftAndStore')}
              </Button>
            </WareLine>
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

function TradingBay({
  crawler,
  store,
  rollFor,
  canWrite,
}: Pick<Props, 'crawler' | 'store' | 'rollFor' | 'canWrite'>) {
  const [rolled, setRolled] = useState<{ roll: number; label: string; tl: number } | null>(null)
  const [offers, setOffers] = useState<Ware[]>([])
  const [choosing, setChoosing] = useState<number | null>(null)
  const [bought, setBought] = useState<ReadonlySet<string>>(new Set())
  const [note, setNote] = useState<string | null>(null)

  async function roll() {
    const die = await rollFor(TRADING_BAY_TABLE, playCopy('tradingBay'))
    const result = performTradingRoll({ crawlerTl: crawler.techLevel, roll: die })
    // What is for sale is picked at random at the rolled Tech Level (p.223).
    setOffers(
      tradeOffers(result.availability, result.sourceTl, (n) => Math.ceil(Math.random() * n))
    )
    setRolled({
      roll: result.roll,
      label: TRADING_AVAILABILITY_LABEL[result.availability],
      tl: result.sourceTl,
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
        setBought((was) => new Set([...was, `${ware.kind}:${ware.slug}`]))
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
            return (
              <WareLine key={`${ware.kind}:${ware.slug}`} ware={ware}>
                {sold ? (
                  <Stat size="mini" label={playCopy('boughtState')} />
                ) : (
                  <>
                    <Button size="mini" onClick={() => setChoosing(choosing === i ? null : i)}>
                      {playCopy('chooseInstead')}
                    </Button>
                    <Button size="mini" disabled={!canWrite} onClick={() => buy(ware)}>
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
                  setOffers((was) => was.map((w, i) => (i === choosing ? ware : w)))
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
