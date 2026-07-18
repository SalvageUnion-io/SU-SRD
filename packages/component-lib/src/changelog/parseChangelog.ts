/**
 * Hand-written changelog markdown parser (no npm deps) shared by both sites so
 * they render an identical, merged changelog. Understands two H2 heading
 * shapes:
 *   (a) release-please:  `## [1.2.3](url) (2026-07-14)`  /  `## 1.2.3 (2026-07-14)`
 *   (b) historical:      `## 2026-07-14 — Some Title`     /  `## 2026-07-14`
 */

export type ChangelogEntry = {
  /** YYYY-MM-DD, always present (dateless sections are skipped). */
  date: string
  /** Semver string for release-please headings; undefined otherwise. */
  version?: string
  /** Free-text title for historical headings; undefined for versioned ones. */
  title?: string
  /** The source label passed to {@link parseChangelog}. */
  area: string
  /** Bullet items collected from the section body. */
  items: string[]
}

const DATE_RE = /\d{4}-\d{2}-\d{2}/
const VERSION_RE = /^\s*\[?(\d+\.\d+\.\d+[\w.-]*)\]?/
const BULLET_RE = /^\s*[*-]\s+(.+)$/
// Leading `**bold**` optionally trailed by a separator (— – - :) — stripped
// while keeping the descriptive text after it.
const LEADING_BOLD_RE = /^\*\*[^*]+\*\*\s*[—–\-:]*\s*/

function cleanItem(raw: string): string {
  return raw.trim().replace(LEADING_BOLD_RE, '').trim()
}

function parseHeading(heading: string): { date: string; version?: string; title?: string } | null {
  const dateMatch = heading.match(DATE_RE)
  if (!dateMatch) return null
  const date = dateMatch[0]

  const versionMatch = heading.match(VERSION_RE)
  if (versionMatch) {
    return { date, version: versionMatch[1] }
  }

  // Historical shape: strip the leading date token and any separator to find
  // an optional title.
  const afterDate = heading.slice(heading.indexOf(date) + date.length)
  const title = afterDate.replace(/^[\s—–\-:|·]+/, '').trim()
  return { date, title: title.length > 0 ? title : undefined }
}

export function parseChangelog(markdown: string, area: string): ChangelogEntry[] {
  const lines = markdown.split(/\r?\n/)

  // Split into H2 sections. Anything before the first H2 (H1, prose,
  // blockquotes) is leading matter and ignored.
  const sections: { heading: string; body: string[] }[] = []
  let current: { heading: string; body: string[] } | null = null
  for (const line of lines) {
    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), body: [] }
      sections.push(current)
    } else if (current) {
      current.body.push(line)
    }
  }

  const entries: ChangelogEntry[] = []
  for (const section of sections) {
    const parsed = parseHeading(section.heading)
    if (!parsed) continue // Skip sections with no date.

    const items: string[] = []
    for (const line of section.body) {
      // `### <x>` subheadings are ignorable group labels — their bullets still
      // count, so we simply don't treat the heading line as a bullet.
      if (line.startsWith('#')) continue
      const bullet = line.match(BULLET_RE)
      if (bullet) {
        const text = cleanItem(bullet[1] ?? '')
        if (text.length > 0) items.push(text)
      }
    }

    // Skip empty-item sections only if they also have no title.
    if (items.length === 0 && !parsed.title) continue

    entries.push({
      date: parsed.date,
      version: parsed.version,
      title: parsed.title,
      area,
      items,
    })
  }

  return entries
}

export function mergeChangelogs(...lists: ChangelogEntry[][]): ChangelogEntry[] {
  const all = lists.flat()
  // Stable sort by date descending; equal dates keep input order.
  return all
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.date === b.entry.date) return a.index - b.index
      return a.entry.date < b.entry.date ? 1 : -1
    })
    .map(({ entry }) => entry)
}
