/**
 * What an Area Salvage's resolve says (Core Book p.248): its table's row, and
 * what Apply carried and left behind, in words; and whether the pilot is an
 * Expert Salvager, whose every Area Salvage finds one more Scrap. Pure apart
 * from the reference lookup. The resolve itself is `useActionsDeck`'s.
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import { resultForTable, SalvageUnionReference } from 'salvageunion-reference'
import type { AreaSalvageResult } from 'salvageunion-reference/rules'
import { AREA_SALVAGE_TABLE } from 'salvageunion-reference/rules'
import type { AreaSalvageHaul } from '../lib/rules/downtimeEconomy'
import { playCopy } from '../messages/play'

/** The Salvaging ability that adds a Scrap to every Area Salvage (Workshop Manual p.40). */
const EXPERT_SALVAGER = 'expert-salvager'

export function isExpertSalvager(pilot: Pick<Pilot, 'abilities'> | null | undefined): boolean {
  return (pilot?.abilities ?? []).includes(EXPERT_SALVAGER)
}

/** The Area Salvage table's row for a d20, verbatim. */
export function areaSalvageRowText(d20: number): string {
  const table = SalvageUnionReference.RollTables.getByName(AREA_SALVAGE_TABLE)?.table
  const row = resultForTable(table, d20)
  return row.success ? row.result.value : ''
}

/** What an Area Salvage's Apply carried, in words. */
export function haulText(
  result: AreaSalvageResult,
  haul: AreaSalvageHaul<unknown>,
  where: string
): string {
  if (result.itemCount > 0) {
    const items = playCopy(result.itemCount > 1 ? 'salvageJackpotTwo' : 'salvageJackpotOne')
    const jackpot = playCopy('salvageJackpot', { items, tl: result.areaTl })
    if (haul.carried === 0 && haul.leftBehind === 0) return jackpot
    return `${jackpot} ${haulText({ ...result, itemCount: 0 }, haul, where)}`
  }
  if (haul.carried === 0 && haul.leftBehind === 0) return playCopy('salvageNothing')
  const carried =
    haul.carried > 0
      ? playCopy('salvageCarried', { count: haul.carried, tl: result.areaTl, where })
      : ''
  const left = haul.leftBehind > 0 ? playCopy('salvageLeftBehind', { count: haul.leftBehind }) : ''
  return [carried, left].filter((t) => t !== '').join(' ')
}
