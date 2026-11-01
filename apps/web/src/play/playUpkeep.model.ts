/**
 * Paying a Downtime's Upkeep from Play (play.md §6, §10): the player's step
 * box (`PlayDowntimeStep`) and the Mediator's Upkeep row both pay it here, in
 * CrawlerSlot's order: claim it (`spendUpkeep`, which answers false when it
 * is already paid this Downtime), then draw the Scrap from the crawler's pool
 * and credit its Upgrade Pool (`payUpkeepPatch`, the Live Sheet's patch too).
 * A short pool is advisory: it spends what it has, the Upkeep still counts as
 * paid, and the words say by how much it was short.
 * The success words wait for the Scrap write to land.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import { crawlerUpkeepCost } from 'salvageunion-reference/rules'
import { payUpkeepPatch } from '../lib/rules/crawlerEconomy'
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
  if (!(await spendUpkeep())) return 'Upkeep is already paid this Downtime.'
  const paid = payUpkeepPatch(store.get('crawler', crawler.id) ?? crawler, tl)
  try {
    await store.update('crawler', crawler.id, paid.patch, PLAY_TXN)
  } catch (err) {
    // The claim stands, so a second press cannot draw it again: say what is left.
    reportWriteFailure(err)
    return playCopy('upkeepNotDrawn', { scrap: crawlerUpkeepCost(tl) })
  }
  const { short } = paid.payment
  if (short > 0) {
    const scrap = crawlerUpkeepCost(tl)
    return playCopy('upkeepShort', { scrap, tl, short, pool: paid.patch.upgradePool })
  }
  return `Paid the Upkeep. Upgrade Pool now ${paid.patch.upgradePool}.`
}
