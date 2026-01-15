/**
 * Calculate the most efficient way to remove scrap to pay for upkeep
 * @param totalNeeded - Total scrap needed in TL1 equivalent
 * @param scrapByTL - Current scrap amounts by tech level
 * @returns Object with scrap to remove by TL and which TLs were affected
 */

import { logger } from '../lib/logger'
export function calculateScrapRemoval(
  totalNeeded: number,
  scrapByTL: Record<number, number>
): {
  updates: Record<string, number>
  affectedTLs: number[]
} {
  const updates: Record<string, number> = {}
  const affectedTLs: number[] = []
  let remaining = totalNeeded

  const techLevels = [6, 5, 4, 3, 2, 1]

  for (const tl of techLevels) {
    if (remaining <= 0) break

    const available = scrapByTL[tl] || 0
    if (available === 0) continue

    const tlValue = tl
    const maxCanUse = Math.floor(remaining / tlValue)
    const toUse = Math.min(maxCanUse, available)

    if (toUse > 0) {
      const fieldName = getTLFieldName(tl)
      updates[`scrap_tl_${fieldName}`] = available - toUse
      affectedTLs.push(tl)
      remaining -= toUse * tlValue
    }
  }

  if (remaining > 0) {
    for (const tl of techLevels) {
      const available = scrapByTL[tl] || 0
      const fieldName = getTLFieldName(tl)
      const alreadyUsed =
        (scrapByTL[tl] || 0) - (updates[`scrap_tl_${fieldName}`] ?? (scrapByTL[tl] || 0))
      const stillAvailable = available - alreadyUsed

      if (stillAvailable > 0 && tl >= remaining) {
        const currentAmount = updates[`scrap_tl_${fieldName}`] ?? (scrapByTL[tl] || 0)
        updates[`scrap_tl_${fieldName}`] = currentAmount - 1
        if (!affectedTLs.includes(tl)) {
          affectedTLs.push(tl)
        }

        const change = tl - remaining

        if (change > 0) {
          const tl1FieldName = getTLFieldName(1)
          const currentTL1 = updates[`scrap_tl_${tl1FieldName}`] ?? scrapByTL[1] ?? 0
          updates[`scrap_tl_${tl1FieldName}`] = currentTL1 + change
          if (!affectedTLs.includes(1)) {
            affectedTLs.push(1)
          }
        }

        remaining = 0
        break
      }
    }
  }

  if (remaining > 0) {
    logger.warn('Not enough scrap to cover upkeep cost')
  }

  return { updates, affectedTLs }
}

/**
 * Get the field name for a tech level
 */
function getTLFieldName(tl: number): string {
  const names = ['one', 'two', 'three', 'four', 'five', 'six']
  return names[tl - 1] ?? 'unknown'
}

/**
 * Check if there's enough scrap to cover a cost
 */
export function hasEnoughScrap(totalNeeded: number, scrapByTL: Record<number, number>): boolean {
  const totalAvailable =
    (scrapByTL[1] || 0) * 1 +
    (scrapByTL[2] || 0) * 2 +
    (scrapByTL[3] || 0) * 3 +
    (scrapByTL[4] || 0) * 4 +
    (scrapByTL[5] || 0) * 5 +
    (scrapByTL[6] || 0) * 6

  return totalAvailable >= totalNeeded
}

/**
 * Check if there's enough scrap at a specific tech level to cover the cost
 * @param requiredAmount - Amount of scrap needed (in units, not TL1 equivalent)
 * @param techLevel - The tech level of scrap required
 * @param scrapByTL - Current scrap amounts by tech level
 */
export function hasEnoughScrapAtTechLevel(
  requiredAmount: number,
  techLevel: number,
  scrapByTL: Record<number, number>
): boolean {
  return (scrapByTL[techLevel] || 0) >= requiredAmount
}
