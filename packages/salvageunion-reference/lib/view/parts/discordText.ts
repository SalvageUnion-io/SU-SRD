/** Small text helpers for the Discord card (`discordCard.ts`). */

/** "Chassis Repair (Fabrication Arm)" inside Fabrication Arm → "Chassis Repair". */
export function stripOwnerSuffix(name: string, ownName: string): string {
  const match = name.match(/^(.*\S)\s*\(([^()]+)\)\s*$/)
  if (!match?.[1] || !match[2]) return name
  return match[2].trim().toLowerCase() === ownName.trim().toLowerCase() ? match[1] : name
}

/** The first number of a range key: "11-19" → 11. */
export function rangeStart(key: string): number {
  const n = Number.parseInt(key, 10)
  return Number.isNaN(n) ? 0 : n
}
