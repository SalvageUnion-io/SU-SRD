/**
 * Homebrew on the SRD (ADR-061), as a page reads it: every pattern a player
 * shares with everyone on the Reference, served by the Worker at
 * `HOMEBREW_PATTERNS_PATH` (`./endpoint.ts`, `worker/homebrew.ts`, from
 * `convex/homebrew.ts`), parsed here into what a row draws.
 *
 * Pure but for `fetchHomebrewPatterns`. The SRD's pages are static and their
 * CSP allows only their own origin, so they never call Convex themselves.
 */

import { publicPath } from 'game-domain/entityKinds'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { MechPatternSchema } from 'game-domain/schemas/pattern'
import type { RefChassis, RefObjectPattern } from 'salvageunion-reference'
import {
  getEntitySlug,
  getHomebrewPatterns,
  nameToSlug,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { appPath } from '../appBase'
import { patternHref } from '../entityHref'
import { asReferencePattern, patternChassis } from '../patterns/patterns'
import type { HomebrewRow } from './endpoint'
import { homebrewPatternsUrl } from './endpoint'

/** Whether a reader asked chassis pages to show homebrew: a per-browser setting. */
export const SHOW_HOMEBREW_KEY = 'su:show-homebrew'

/** A homebrew pattern whose body parsed, with its chassis. */
export type HomebrewItem = {
  appId: string
  madeBy: string
  pattern: MechPattern
  chassis: RefChassis
}

/**
 * A row as a page draws it, or null when its body does not parse here (a
 * schema newer than this build) or its chassis is not in the reference:
 * such a row is left out rather than drawn broken.
 */
export function homebrewItem(row: HomebrewRow): HomebrewItem | null {
  const parsed = MechPatternSchema.safeParse(row.body)
  if (!parsed.success) return null
  const chassis = patternChassis(parsed.data)
  return chassis ? { appId: row.appId, madeBy: row.madeBy, pattern: parsed.data, chassis } : null
}

/** Where a homebrew pattern opens: its public page in the app (ADR-032). */
export function homebrewHref(item: HomebrewItem): string {
  return appPath(publicPath('pattern', item.appId, item.pattern.name))
}

/**
 * One row of a Homebrew list, whoever made it: a player's shared pattern, or a
 * built-in one from the reference (a Mech Monday design), credited to its
 * author and opening its own SRD page, which links the post it came from.
 */
export type HomebrewEntry = {
  key: string
  madeBy: string
  pattern: RefObjectPattern
  chassis: RefChassis
  href: string
  /** A built-in one's credit: where it was published (`Mech Monday`), beside its stamp. */
  source?: string
}

/** A player's shared pattern as a list row. */
export function playerHomebrewEntry(item: HomebrewItem): HomebrewEntry {
  return {
    key: item.appId,
    madeBy: item.madeBy,
    pattern: asReferencePattern(item.pattern),
    chassis: item.chassis,
    href: homebrewHref(item),
  }
}

/**
 * The reference's built-in Homebrew Patterns (`homebrew` in the data), one
 * chassis's or every chassis's, in the data's order. Needs the chassis data
 * loaded.
 */
export function builtInHomebrewEntries(chassisRef?: string): HomebrewEntry[] {
  const hosts = SalvageUnionReference.findAllIn(
    'chassis',
    (chassis) => chassisRef === undefined || getEntitySlug(chassis) === chassisRef
  )
  return hosts.flatMap((chassis) => {
    const slug = getEntitySlug(chassis)
    return getHomebrewPatterns(chassis).map((pattern) => {
      const ref = pattern as RefObjectPattern
      return {
        key: `${slug}/${nameToSlug(ref.name)}`,
        madeBy: ref.author ?? '',
        pattern: ref,
        chassis,
        href: patternHref('chassis', slug, nameToSlug(ref.name)),
        ...(ref.source ? { source: ref.source } : {}),
      }
    })
  })
}

/**
 * Homebrew rows from the Worker; a failed read throws. Parsed with
 * {@link homebrewItems} once the reference data is loaded, which resolving a
 * chassis needs.
 */
export async function fetchHomebrewPatterns(
  chassisRef?: string,
  fetchImpl: typeof fetch = fetch
): Promise<HomebrewRow[]> {
  const res = await fetchImpl(homebrewPatternsUrl(chassisRef))
  if (!res.ok) throw new Error(`homebrew ${res.status}`)
  return (await res.json()) as HomebrewRow[]
}

/** The drawable rows, as items. */
export function homebrewItems(rows: readonly HomebrewRow[]): HomebrewItem[] {
  return rows.map(homebrewItem).filter((item) => item !== null)
}

/** The reader's Show Homebrew setting; off when storage is not there. */
export function readShowHomebrew(): boolean {
  try {
    return localStorage.getItem(SHOW_HOMEBREW_KEY) === 'on'
  } catch {
    return false
  }
}

/** Remember the reader's Show Homebrew setting, where storage allows. */
export function writeShowHomebrew(on: boolean): void {
  try {
    if (on) localStorage.setItem(SHOW_HOMEBREW_KEY, 'on')
    else localStorage.removeItem(SHOW_HOMEBREW_KEY)
  } catch {
    // Private browsing or blocked storage: the switch holds for this page only.
  }
}
