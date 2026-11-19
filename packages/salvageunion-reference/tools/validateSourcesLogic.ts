/**
 * The books ARE the sources: every `source` an entity cites (the
 * `SourceSchema` enum) is one record in `sources.json`, named and sourced as
 * itself, with a store link; and every record is a book the enum names. Then a
 * cite links to its book's page, and the book's page to its store (ruleset
 * Source 2), for every entity in the dataset.
 */

export type SourceIssue = { book: string; detail: string }

export function findSourceIssues(
  books: readonly string[],
  records: readonly Record<string, unknown>[]
): SourceIssue[] {
  const issues: SourceIssue[] = []
  for (const book of books) {
    const found = records.filter((r) => r.name === book)
    if (found.length !== 1) {
      issues.push({
        book,
        detail: `is a source in SourceSchema but has ${found.length} records in sources.json; it needs exactly one`,
      })
    }
  }
  for (const record of records) {
    const name = String(record.name ?? '(unnamed)')
    if (!books.includes(name)) {
      issues.push({ book: name, detail: 'is in sources.json but SourceSchema does not name it' })
    }
    if (record.source !== record.name) {
      issues.push({
        book: name,
        detail: `cites "${String(record.source)}" as its source, not itself`,
      })
    }
    if (typeof record.purchaseLink !== 'string' || record.purchaseLink.length === 0) {
      issues.push({ book: name, detail: 'has no purchaseLink' })
    }
  }
  return issues
}
