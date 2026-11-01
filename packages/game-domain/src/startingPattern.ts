import { nameToSlug, normalizePatternName } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'

/**
 * Where a mech started: the slug of the chassis pattern its loadout was
 * built from (`Mech.startingPatternRef`, within its `chassisRef`), as
 * provenance. The mech's own name is its pattern's name; this is never shown
 * and never rewritten by a rename.
 */

/** The chassis pattern named `patternName` (" Pattern" or not) as a ref; undefined when the chassis has none. */
export function startingPatternRef(chassisRef: string, patternName: string): string | undefined {
  const wanted = normalizePatternName(patternName.trim())
  if (wanted === '') return undefined
  const pattern = (resolveChassisRef(chassisRef)?.patterns ?? []).find(
    (p) => normalizePatternName(p.name) === wanted
  )
  return pattern === undefined ? undefined : nameToSlug(pattern.name)
}

/**
 * A mech body stored before `patternName` became `startingPatternRef`: the
 * old name resolved against its chassis's patterns, kept only when it names
 * one (a renamed mech's copied name names none).
 */
export function foldPatternName(body: Record<string, unknown>): Record<string, unknown> {
  const { patternName } = body
  if (typeof patternName !== 'string' || body.startingPatternRef !== undefined) return body
  const ref =
    typeof body.chassisRef === 'string'
      ? startingPatternRef(body.chassisRef, patternName)
      : undefined
  return ref === undefined ? body : { ...body, startingPatternRef: ref }
}
