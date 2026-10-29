/**
 * Paying a Downtime's Upkeep from Play (play.md §6, §10): the player's step
 * box (`PlayDowntimeStep`) and the Mediator's Upkeep row both pay it here, in
 * CrawlerSlot's order: claim it (`spendUpkeep`, which answers false when it
 * is already paid this Downtime), then draw the Scrap from the crawler's pool
 * and credit its Upgrade Pool (`payUpkeepPatch`, the Live Sheet's patch too).
 * A pool that cannot cover it pays nothing and says by how much it is short.
 * The success words wait for the Scrap write to land.
 */

import { DOWNTIME_UPKEEP_SCRAP } from 'game-domain/rules/downtime'
import type { Crawler } from 'game-domain/schemas/crawler'
import { payUpkeep, payUpkeepPatch, upkeepShortfall } from '../lib/rules/crawlerEconomy'
import { reportWriteFailure } from '../lib/runWrite'
import { playCopy } from '../messages/play'
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
    return playCopy('upkeepShort', {
      scrap: DOWNTIME_UPKEEP_SCRAP,
      tl,
      short: upkeepShortfall(pool, tl),
    })
  }
  if (!(await spendUpkeep())) return 'Upkeep is already paid this Downtime.'
  const paid = payUpkeepPatch(store.get('crawler', crawler.id) ?? crawler, tl)
  if (paid === null) return null
  try {
    await store.update('crawler', crawler.id, paid.patch, PLAY_TXN)
  } catch (err) {
    // The claim stands, so a second press cannot draw it again: say what is left.
    reportWriteFailure(err)
    return playCopy('upkeepNotDrawn', { scrap: DOWNTIME_UPKEEP_SCRAP })
  }
  return `Paid the Upkeep. Upgrade Pool now ${paid.patch.upgradePool}.`
}
