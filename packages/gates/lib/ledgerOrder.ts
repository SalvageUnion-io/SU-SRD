/**
 * A Ledger's column order (ledger.md L5, ruleset §2.6): the stat order, read
 * off the head stamps. A column whose stamp names a stat keeps that stat's
 * place; a list drops a column, never moves one. Words that place the entity
 * (a tree, a crew lead, a maker) and the one quiet line carry no rank and sit
 * where L5 puts them.
 */

/** Each stat's place, under every stamp a Ledger prints it by. */
const RANKS: readonly (readonly string[])[] = [
  ['tl', 'lvl', 'tech level', 'level'],
  ['slots'],
  ['sv', 'salvage value'],
  ['sp', 'hp', 'structure points', 'hit points', 'max sp'],
  ['ep', 'energy points'],
  ['bio', 'bio-salvage'],
  ['sys', 'system slots'],
  ['mods', 'module slots'],
  ['heat', 'heat capacity'],
  ['cargo', 'cargo capacity'],
  ['upkeep'],
  ['upgrade'],
  ['action'],
  ['rng', 'range'],
  ['dmg', 'damage'],
  ['traits'],
  ['uses'],
  ['cost', 'ap'],
]

/** A head stamp's place in the stat order; none for a column of words. */
export function ledgerRank(label: string): number | undefined {
  const key = label.trim().toLowerCase()
  const rank = RANKS.findIndex((names) => names.includes(key))
  return rank === -1 ? undefined : rank
}

/** Each head stamp that stands before a stat the order puts ahead of it, one line apiece. */
export function ledgerOrderFaults(labels: readonly string[]): string[] {
  const faults: string[] = []
  let last: { label: string; rank: number } | undefined
  for (const label of labels) {
    const rank = ledgerRank(label)
    if (rank === undefined) continue
    if (last && rank < last.rank) faults.push(`${label} after ${last.label}`)
    else last = { label, rank }
  }
  return faults
}
