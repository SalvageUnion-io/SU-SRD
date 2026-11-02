/**
 * Paying a Downtime's Upkeep from Play (play.md §6, §10): the player's step
 * box (`PlayDowntimeStep`) and the Mediator's Upkeep row both pay it here.
 * The draw from the crawler's pool and the credit to its Upgrade Pool
 * (`payUpkeepPatch`, the Live Sheet's patch too) go as this Downtime's one
 * Upkeep op (`claim`), so the payment and its once-per-Downtime mark land
 * together, and a second press changes nothing. A short pool is advisory:
 * it spends what it has, the Upkeep still counts as paid, and the words say
 * by how much it was short.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import { crawlerUpkeepCost } from 'salvageunion-reference/rules'
import { payUpkeepPatch } from '../lib/rules/crawlerEconomy'
import { playCopy } from '../messages/play'
import type { PlayStore } from './play.model'
import type { PlayDowntime } from './situation.model'

/** What happened, in words, or null with no crawler to pay for. */
export async function payDowntimeUpkeep({
  crawler,
  store,
  claim,
}: {
  crawler: Crawler | null
  store: Pick<PlayStore, 'get'>
  claim: PlayDowntime['claim']
}): Promise<string | null> {
  if (crawler === null) return null
  const tl = crawler.techLevel
  const paid = payUpkeepPatch(store.get('crawler', crawler.id) ?? crawler, tl)
  if (!(await claim('upkeep', crawler.id, paid.patch)))
    return 'Upkeep is already paid this Downtime.'
  const { short } = paid.payment
  if (short > 0) {
    const scrap = crawlerUpkeepCost(tl, crawler.type)
    return playCopy('upkeepShort', { scrap, tl, short, pool: paid.patch.upgradePool })
  }
  return `Paid the Upkeep. Upgrade Pool now ${paid.patch.upgradePool}.`
}
