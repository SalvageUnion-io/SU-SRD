/**
 * Processing Inert Meld Nanites in Downtime (False Flag p.66), from Play: the
 * player's step box (`PlayDowntimeStep`) and the Mediator's Downtime list
 * both process them here, in the Craft step, as Upkeep is paid in its own.
 *
 * Every Inert pile rolls a d20 and is spent; a 20 is an Active Meld Nanite
 * (`processNanites`). It needs an Intact Nanite Processing Bay. The spent
 * piles go as this Downtime's one Nanites op (`claim`), as Upkeep does, so
 * two presses or two tabs cannot spend the same piles twice. The dice go
 * on the roll log (`recordPlayRoll`, play.md §8) and the words come back only
 * once the op has landed.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import { exoticBucket, naniteProcessingGate, processNanites } from '../lib/rules/exoticSalvage'
import { playCopy } from '../messages/play'
import type { PlayStore } from './play.model'
import { recordPlayRoll } from './playRolls.model'
import type { PlayDowntime } from './situation.model'

/** What the crawler's bay can do this Downtime, and how many piles wait. */
export function naniteStatus(crawler: Crawler | null) {
  const gate = crawler
    ? naniteProcessingGate(crawler)
    : { present: false, damaged: false, operational: false }
  const inert = crawler ? exoticBucket(crawler.scrapPool ?? {}, 'inertNanites') : 0
  return { ...gate, inert }
}

/** Process every Inert pile; what happened, in words, or null with nothing done. */
export async function processDowntimeNanites({
  crawler,
  store,
  rollD20,
  label,
  claim,
}: {
  crawler: Crawler | null
  store: Pick<PlayStore, 'get'>
  rollD20: () => number
  /** What the roll log calls it: the step it was processed in. */
  label: string
  claim: PlayDowntime['claim']
}): Promise<string | null> {
  if (crawler === null) return null
  const fresh = store.get('crawler', crawler.id) ?? crawler
  if (!naniteProcessingGate(fresh).operational) return null
  const result = processNanites(fresh.scrapPool ?? {}, rollD20)
  if (result.processed === 0) return playCopy('noInertNanites')
  if (!(await claim('nanites', crawler.id, { scrapPool: result.pool }))) {
    return playCopy('nanitesAlreadyProcessed')
  }
  const said = playCopy('processedNanites', { processed: result.processed, found: result.found })
  recordPlayRoll({
    tableName: playCopy('processNanites'),
    rolls: result.rolls,
    label,
    outcome: said,
  })
  return said
}
