import { test } from '@playwright/test'

/**
 * Rules whose screens do not hold them yet (hard-rules.md R40 and R41). A gate
 * finds them like any other rule, but reports them on its test (an annotation
 * per rule, with a count and the first findings) and never fails on them.
 * The work that makes the screens hold a rule deletes its entry here, in the
 * same change, and from then on its findings fail.
 *
 * Keyed by the finding's rule: the text before a fault's first `:`
 * (`_chipStrips.ts`), or a nesting finding's `rule`.
 */
const PENDING_RULES: Readonly<Record<string, string>> = {
  align: 'R40 (EDL E22): a name and its title cut-out sit at the left of their head',
  'tab-size': "R41 (§4.7): a Button beside Tabs is the Tabs' Size",
}

/** The rule a `_chipStrips.ts`-style fault names: the text before its first `:`. */
export const ruleOfFault = (fault: string): string => fault.slice(0, fault.indexOf(':'))

/**
 * The findings that fail: every one whose rule is not pending. The pending
 * ones are reported on the running test under `gate`, one annotation a rule.
 */
export function holdPending<T extends { rule: string; line: string }>(
  gate: string,
  findings: readonly T[]
): T[] {
  const pending = new Map<string, string[]>()
  const enforced: T[] = []
  for (const f of findings) {
    if (f.rule in PENDING_RULES) pending.set(f.rule, [...(pending.get(f.rule) ?? []), f.line])
    else enforced.push(f)
  }
  for (const [rule, lines] of pending) {
    const shown = lines.slice(0, 20).join('\n')
    const more = lines.length > 20 ? `\n… and ${lines.length - 20} more` : ''
    test.info().annotations.push({
      type: 'pending rule',
      description: `${gate}: ${rule}, ${lines.length} finding(s), not failing (${PENDING_RULES[rule]})\n${shown}${more}`,
    })
  }
  return enforced
}
