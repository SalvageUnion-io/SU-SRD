/**
 * The search index's names alone (`/search-names.json`, r8 G1): what the first
 * search on a slow line matches while the whole index (`/search-index.json`,
 * its prose and its row models) is still on its way. A row is a tuple, so the
 * file stays a few kilobytes: its name, its kind, its slug, and a pattern's or
 * rule's own page and kind where it has one.
 */
import type { CompactSearchEntry } from './searchIndexTypes'

/** `[name, schemaName, slug, page?, kind?]`. */
export type SearchNameRow =
  | [string, CompactSearchEntry['schemaName'], string]
  | [string, CompactSearchEntry['schemaName'], string, string, string]

/** The index cut to its names. */
export function searchNames(entries: readonly CompactSearchEntry[]): SearchNameRow[] {
  return entries.map((entry) =>
    entry.pattern
      ? [entry.name, entry.schemaName, entry.slug, entry.pattern.href, entry.pattern.kind]
      : [entry.name, entry.schemaName, entry.slug]
  )
}

/**
 * The names as entries the matcher reads: each one's text is its name alone,
 * so only a name matches, and it carries no model (its result is a plain line).
 */
export function namesIndex(rows: readonly SearchNameRow[]): CompactSearchEntry[] {
  return rows.map(([name, schemaName, slug, href, kind]) => ({
    id: `${schemaName}:${slug}:${href ?? ''}`,
    name,
    slug,
    schemaName,
    schemaTitle: schemaName,
    text: name.toLowerCase(),
    ...(href && kind ? { pattern: { href, kind } } : {}),
  }))
}
