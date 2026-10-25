/**
 * Paying a Downtime's Upkeep from Play (play.md §6, §10): the player's step
 * box (`PlayDowntimeStep`) and the Mediator's Upkeep row both pay it here, in
 * CrawlerSlot's order: claim it (`spendUpkeep`, which answers false when it
 * is already paid this Downtime), then draw the Scrap from the crawler's pool
 * and credit its Upgrade Pool. A pool that cannot cover it pays nothing and
 * says by how much it is short.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import { payUpkeep, upkeepShortfall } from '../lib/rules/crawlerEconomy'
import { runWrite } from '../lib/runWrite'
import { PLAY_TXN } from '../replica/provenance'
import type { PlayStore } from './play.model'
import { crawlerTl } from './playDowntime.model'

/** What happened, in words, or null with no crawler to pay for. */
export async function payDowntimeUpkeep({
  crawler,
  store,
  spendUpkeep,
}: {
  crawler: Crawler | null
  store: Pick<PlayStore, 'get' | 'update'>
  /** The Downtime's claim: true when this call paid it. */
  spendUpkeep: () => Promise<boolean>
}): Promise<string | null> {
  if (crawler === null) return null
  const tl = crawlerTl(crawler)
  const pool = (store.get('crawler', crawler.id) ?? crawler).scrapPool ?? {}
  if (payUpkeep(pool, tl) === null) {
    return `Upkeep is 5 Scrap of Tech ${tl} or higher, and the pool is ${upkeepShortfall(pool, tl)} short. Unpaid Upkeep is a roll on the Crawler Deterioration table, on the crawler sheet.`
  }
  if (!(await spendUpkeep())) return 'Upkeep is already paid this Downtime.'
  const c = store.get('crawler', crawler.id) ?? crawler
  const payment = payUpkeep(c.scrapPool ?? {}, tl)
  if (payment === null) return null
  const upgradePool = (c.upgradePool ?? 0) + payment.upgradeCredit
  runWrite(() =>
    store.update('crawler', crawler.id, { scrapPool: payment.pool, upgradePool }, PLAY_TXN)
  )
  return `Paid the Upkeep. Upgrade Pool now ${upgradePool}.`
}
