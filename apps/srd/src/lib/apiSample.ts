import type { SURefChassis } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { SalvageUnionReference } from './gameData'

/**
 * The real record every JSON API example describes, on `/api` and in
 * `llms.txt`: the first chassis by slug.
 *
 * Deterministic on purpose: picking "whatever is first in the file" would move
 * the examples on unrelated data edits. Derived, never typed out, because a
 * hand-written example slug is how both surfaces once linked a chassis that
 * does not exist.
 *
 * Call it inside a page or endpoint body, never at module scope: the
 * `noModuleScopeReferenceCall` Biome plugin forbids a `SalvageUnionReference`
 * call that would run before the build's `preload()`.
 */
export function apiSampleChassis(): SURefChassis {
  const [first] = [...SalvageUnionReference.Chassis.all()].sort((a, b) =>
    getEntitySlug(a).localeCompare(getEntitySlug(b))
  )
  if (!first) throw new Error('apiSampleChassis: the dataset has no chassis to sample')
  return first
}
