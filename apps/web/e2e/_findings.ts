/**
 * What every layout scanner (`_x.ts`) returns: one `Finding` per fault on the
 * page as it stands, its rule and the fault in words. A gate places them on
 * the view it read (`place`), and holds the placed lines to its baseline
 * (`_designRoutes.ts`) or to none (`expectCorpusClean`).
 */
export type Finding = { rule: string; detail: string }

/** A finding on a view: `<where>: <detail>`, the line a gate reports and a baseline matches. */
export type Placed = { rule: string; line: string }

/** The rule a `kind: …` fault string names (`_chipStrips.ts`'s shape): the text before its first `:`. */
const ruleOfFault = (fault: string): string => fault.slice(0, fault.indexOf(':'))

/** Findings from fault strings: each under `rule`, or under the kind its text leads with. */
export function fromFaults(faults: readonly string[], rule?: string): Finding[] {
  return faults.map((fault) => ({ rule: rule ?? ruleOfFault(fault), detail: fault }))
}

/** Place findings on the view `where`, one line per distinct fault, a repeat counted (`×n`). */
export function place(where: string, found: readonly Finding[]): Placed[] {
  const lines = new Map<string, { rule: string; n: number }>()
  for (const { rule, detail } of found) {
    const line = `${where}: ${detail}`
    const seen = lines.get(line)
    lines.set(line, { rule, n: (seen?.n ?? 0) + 1 })
  }
  return [...lines].map(([line, { rule, n }]) => ({ rule, line: n > 1 ? `${line} (×${n})` : line }))
}
