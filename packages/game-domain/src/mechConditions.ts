/**
 * A mech's conditions are one list, `conditions[]`. Shutdown, Vulnerable and
 * Destroyed are labels on it like any other: the Reactor writes them there,
 * and the conditions editor clears them there.
 *
 * Bodies saved before that kept the three as boolean flags beside the list;
 * `foldMechFlags` moves a true flag onto the list as its label, so every
 * parse of a stored mech reads one list (`withoutRetired`).
 *
 * A leaf: it imports nothing, so the Discord bot may load it.
 */

/** The labels the Reactor writes. */
export type ReactorCondition = 'Shutdown' | 'Vulnerable' | 'Destroyed'

const FLAGS = [
  ['shutdown', 'Shutdown'],
  ['vulnerable', 'Vulnerable'],
  ['destroyed', 'Destroyed'],
] as const satisfies readonly (readonly [string, ReactorCondition])[]

const same = (a: string, b: string) => a.trim().toLowerCase() === b.toLowerCase()

/** The list carries the label, in any case. */
export function hasCondition(conditions: readonly string[], label: string): boolean {
  return conditions.some((c) => same(c, label))
}

/** The list with the label on (added once) or off (every spelling of it removed). */
export function withCondition(
  conditions: readonly string[],
  label: ReactorCondition,
  on: boolean
): string[] {
  if (!on) return conditions.filter((c) => !same(c, label))
  return hasCondition(conditions, label) ? [...conditions] : [...conditions, label]
}

/** A stored body's string conditions, with any legacy true flag as its label. */
export function storedMechConditions(body: Record<string, unknown>): string[] {
  let conditions = Array.isArray(body.conditions)
    ? body.conditions.filter((c): c is string => typeof c === 'string')
    : []
  for (const [flag, label] of FLAGS) {
    if (body[flag] === true) conditions = withCondition(conditions, label, true)
  }
  return conditions
}

/** A mech body with its legacy flags folded into `conditions[]` and dropped. */
export function foldMechFlags(body: Record<string, unknown>): Record<string, unknown> {
  if (!FLAGS.some(([flag]) => Object.hasOwn(body, flag))) return body
  const folded: Record<string, unknown> = { ...body, conditions: storedMechConditions(body) }
  for (const [flag] of FLAGS) delete folded[flag]
  return folded
}
