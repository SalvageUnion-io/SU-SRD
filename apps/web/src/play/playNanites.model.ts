/**
 * Processing Inert Meld Nanites in Downtime (False Flag p.66), from Play: the
 * player's step box (`PlayDowntimeStep`) and the Mediator's Downtime list
 * both process them here, in the Craft step, as Upkeep is paid in its own.
 *
 * Every Inert pile rolls a d20 and is spent; a 20 is an Active Meld Nanite
 * (`processNanites`). It needs an Intact Nanite Processing Bay. It is claimed
 * once per Downtime first (`spendNanites`, which answers false when it is
 * already done), as Upkeep is, so two presses or two tabs cannot roll the
 * same piles twice. The dice go
 * on the roll log (`recordPlayRoll`, play.md §8) and the words come back only
 * once the write has landed; a refused write is said and returns null.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import { exoticBucket, naniteProcessingGate, processNanites } from '../lib/rules/exoticSalvage'
import { reportWriteFailure } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { PLAY_TXN } from '../replica/provenance'
import type { PlayStore } from './play.model'
import { recordPlayRoll } from './playRolls.model'

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
  spendNanites,
}: {
  crawler: Crawler | null
  store: Pick<PlayStore, 'get' | 'update'>
  rollD20: () => number
  /** What the roll log calls it: the step it was processed in. */
  label: string
  /** The Downtime's claim: true when this call processes them. */
  spendNanites: () => Promise<boolean>
}): Promise<string | null> {
  if (crawler === null) return null
  const fresh = store.get('crawler', crawler.id) ?? crawler
  if (!naniteProcessingGate(fresh).operational) return null
  const result = processNanites(fresh.scrapPool ?? {}, rollD20)
  if (result.processed === 0) return playCopy('noInertNanites')
  if (!(await spendNanites())) return playCopy('nanitesAlreadyProcessed')
  try {
    await store.update('crawler', crawler.id, { scrapPool: result.pool }, PLAY_TXN)
  } catch (err) {
    reportWriteFailure(err)
    return null
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
