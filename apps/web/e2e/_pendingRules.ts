import { test } from '@playwright/test'

/**
 * Rules whose screens do not hold them yet (hard-rules.md, "pending"). A gate
 * finds them like any other rule, but reports them on its test (an annotation
 * per rule, with a count and the first findings) and fails on them only past
 * their `ceiling`: the most findings one gate's walk may make of the rule. The
 * ceiling is a ratchet: each annotation prints the count beside it, so a walk
 * well under it says to lower it, and one over it fails with every finding of
 * the rule. The work that makes the screens
 * hold a rule deletes its entry here, in the same change, and from then on its
 * findings fail.
 *
 * Keyed by the finding's rule (`_findings.ts`). `packages/gates/lib/canon.ts`
 * reads these keys, so `bun run check canon --list` marks the gates pending.
 */
const PENDING_RULES: Readonly<Record<string, { law: string; ceiling: number }>> = {
  // Hierarchy at render (R55, `_hierarchy.ts`).
  'type-ladder': { law: '§4.8', ceiling: 240 },
  'slab-size': { law: '§4.9', ceiling: 10 },
  'stray-head': { law: 'R53', ceiling: 4 },
  'nested-slab': { law: 'R53', ceiling: 6 },
  'make-rust': { law: '§3.13', ceiling: 12 },
  'stamp-twin': { law: '§3.13', ceiling: 2 },
  'tool-title-clip': { law: 'C12', ceiling: 1 },
  measure: { law: '§1.10', ceiling: 2 },
}

/**
 * The findings that fail: every one whose rule is not pending, and every one
 * of a pending rule past its ceiling. The pending ones are reported on the
 * running test under `gate`, one annotation a rule.
 */
export function holdPending<T extends { rule: string; line: string }>(
  gate: string,
  findings: readonly T[]
): T[] {
  const pending = new Map<string, T[]>()
  const enforced: T[] = []
  for (const f of findings) {
    if (f.rule in PENDING_RULES) pending.set(f.rule, [...(pending.get(f.rule) ?? []), f])
    else enforced.push(f)
  }
  for (const [rule, found] of pending) {
    const { law, ceiling } = PENDING_RULES[rule] ?? { law: '', ceiling: 0 }
    const lines = found.map((f) => f.line)
    const shown = lines.slice(0, 20).join('\n')
    const more = lines.length > 20 ? `\n… and ${lines.length - 20} more` : ''
    const over = lines.length > ceiling
    test.info().annotations.push({
      type: 'pending rule',
      description: `${gate}: ${rule}, ${lines.length} finding(s) against a ceiling of ${ceiling}, ${over ? 'FAILING' : 'not failing'} (${law})\n${shown}${more}`,
    })
    if (over) enforced.push(...found)
  }
  return enforced
}
