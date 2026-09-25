/**
 * `--only=a,b` parsing for `validate.ts`, kept in its own module so it can be
 * tested without importing the runner — which pulls every check adapter, the
 * `--fix` writer and the data loader into the coverage set on import.
 */

/** The ids of every check `validate.ts` runs, in run order. */
export const CHECK_IDS = [
  'ids',
  'slugs',
  'references',
  'actions',
  'action-backrefs',
  'orphans',
  'content-dupes',
  'traits',
  'parity',
  'double-encoding',
  'schemas',
] as const

export type CheckId = (typeof CHECK_IDS)[number]

/** The checks named by `--only=a,b`, or all of them. Throws on an unknown id. */
export function selectChecks<T extends { id: string }>(
  checks: readonly T[],
  argv: readonly string[]
): T[] {
  const only = argv.find((a) => a.startsWith('--only='))?.slice('--only='.length)
  if (!only) return [...checks]
  const ids = only.split(',').filter(Boolean)
  const unknown = ids.filter((id) => !checks.some((c) => c.id === id))
  if (unknown.length > 0) {
    throw new Error(
      `unknown check(s): ${unknown.join(', ')}. Known: ${checks.map((c) => c.id).join(', ')}`
    )
  }
  return checks.filter((c) => ids.includes(c.id))
}
