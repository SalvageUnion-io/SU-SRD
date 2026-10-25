/**
 * The numbered entries of a markdown doc, and the `decisions` check over
 * docs/ARCHITECTURE.md: every ADR an entry, folded into one Area, or retired.
 * `tools/check-doc-drift.ts` runs it with the other doc-drift checks.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CheckResult } from './check-doc-drift'

const read = (root: string, relPath: string): string => readFileSync(join(root, relPath), 'utf-8')

/** The heading that opens the architecture decision records. */
const DECISIONS_HEADING = /^## Decisions$/m

/**
 * A markdown doc up to its `## Decisions` heading: the part that describes the
 * code as it is now. The ADR entries below also record what was retired.
 */
export function liveTextOf(source: string): string {
  const at = source.search(DECISIONS_HEADING)
  return at === -1 ? source : source.slice(0, at)
}

/** One numbered list entry: its number, the ADR it names (if any), its lines and their 0-based indices. */
type Entry = { n: number; adr: number | undefined; start: number; lines: string[]; at: number[] }

/** An entry's opening line: `12. **ADR-012 Title**` or `3. **Headline**`. */
const ENTRY_START = /^(\d+)\.\s+\*\*(?:ADR-(\d+)\b)?/

/** The numbered entries of each `## ` section, each with its continuation lines. */
export function entriesOf(source: string): (Entry & { section: string })[] {
  const entries: (Entry & { section: string })[] = []
  let section = ''
  let inFence = false
  for (const [i, line] of source.split('\n').entries()) {
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence
    if (inFence) continue
    if (/^#{1,6}\s/.test(line)) {
      section = line.replace(/^#+\s+/, '')
      entries.push({ n: Number.NaN, adr: undefined, start: i, lines: [], at: [], section })
      continue
    }
    const m = line.match(ENTRY_START)
    if (m) {
      const adr = m[2] === undefined ? undefined : Number(m[2])
      entries.push({ n: Number(m[1]), adr, start: i, lines: [line], at: [i], section })
    } else if (line.trim() !== '') {
      entries.at(-1)?.lines.push(line)
      entries.at(-1)?.at.push(i)
    }
  }
  return entries.filter((entry) => !Number.isNaN(entry.n))
}

/** The ADR entries under `## Decisions`. */
const adrEntries = (source: string) =>
  entriesOf(source).filter((entry) => entry.section === 'Decisions' && entry.adr !== undefined)

// ─── decisions ─────────────────────────────────────────────────────────────

/** The one file the ADRs live in, as the numbered entries under its `## Decisions`. */
const DECISIONS_DOC = 'docs/ARCHITECTURE.md'

/** The ADR count when the ADRs became one-entry summaries: none may go missing. */
const ADR_FLOOR = 45

const adrId = (n: number): string => `ADR-${String(n).padStart(3, '0')}`

/**
 * The ADRs named on the `Retired …:` line under `## Decisions`: wholly
 * superseded, so they keep their number but no entry (their text is in git).
 */
function retiredAdrs(source: string): Set<number> {
  const at = source.search(DECISIONS_HEADING)
  const section = at === -1 ? '' : source.slice(at).split(/\n## /)[0]
  const line = section?.match(/^Retired\b[^:\n]*:(.*)$/m)?.[1] ?? ''
  return new Set([...line.matchAll(/ADR-(\d{3})\b/g)].map((m) => Number(m[1])))
}

/** An Area's headline naming the ADRs folded into it: `3. **Name** · ADR-005, ADR-013 <a id="slug"></a>`. */
const FOLDED_LIST = /^\d+\.\s+\*\*[^*]+\*\*\s+·\s+(ADR-\d{3}(?:,\s*ADR-\d{3})*)(?:\s|$)/

/**
 * The ADRs folded into the spec: each named on the headline of the one Area
 * whose text now holds its rule, mapped to the line(s) that name it.
 */
function foldedAdrs(source: string): Map<number, number[]> {
  const folded = new Map<number, number[]>()
  for (const entry of entriesOf(source)) {
    if (entry.section !== 'Areas') continue
    const list = (entry.lines[0] ?? '').match(FOLDED_LIST)?.[1] ?? ''
    for (const m of list.matchAll(/ADR-(\d{3})/g)) {
      const n = Number(m[1])
      folded.set(n, [...(folded.get(n) ?? []), entry.start + 1])
    }
  }
  return folded
}

/** "Amends ADR-022", "Supersedes ADR-004", "reverses ADR-019": one ADR acting on another. */
const ACTS_ON = /\b(amends|supersedes|reverses|replaces)\b[\s*_]*\[?ADR-(\d{3})\b/gi

/**
 * An ADR entry that amends, supersedes or reverses another must be named in
 * that other entry, which is where a reader of it looks first.
 */
function missingBackReferences(source: string): string[] {
  const text = new Map(adrEntries(source).map((entry) => [entry.adr, entry.lines.join('\n')]))
  const failures: string[] = []
  for (const [n, body] of text) {
    const self = adrId(n as number)
    for (const m of body.matchAll(ACTS_ON)) {
      const target = Number(m[2])
      if (target === n || !text.has(target) || text.get(target)?.includes(self)) continue
      failures.push(
        `${DECISIONS_DOC}: ${self} ${(m[1] as string).toLowerCase()} ${adrId(target)}, but ` +
          `${adrId(target)}'s entry does not name ${self}. Add "amended by ${self}" there.`
      )
    }
  }
  return failures
}

/** Where an ADR's full text lives when it is kept: `docs/adr/NNN-slug.md`. */
const ADR_DIR = 'docs/adr'
const ADR_FILE = /^(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/

/** Every way a `docs/adr/` file breaks the layout or loses its entry's link. */
function adrFileFailures(root: string, source: string): { count: number; failures: string[] } {
  const failures: string[] = []
  const dir = join(root, ADR_DIR)
  const names = existsSync(dir) ? readdirSync(dir).sort() : []
  const entries = new Map(adrEntries(source).map((entry) => [entry.adr, entry]))
  const seen = new Map<number, string>()
  for (const name of names) {
    const doc = `${ADR_DIR}/${name}`
    const m = name.match(ADR_FILE)
    if (!m) {
      failures.push(`${doc} is not an ADR file. Name it \`NNN-slug.md\` (lowercase, hyphenated).`)
      continue
    }
    const n = Number(m[1])
    const other = seen.get(n)
    if (other) failures.push(`${adrId(n)} has two files, ${other} and ${doc}. Keep one.`)
    seen.set(n, doc)
    const entry = entries.get(n)
    if (entry === undefined) {
      failures.push(
        `${doc} has no ${adrId(n)} entry under \`## Decisions\` in ${DECISIONS_DOC}. A folded ADR keeps no file: its detail moves to its Area's spec doc in docs/architecture/.`
      )
    } else if (!(entry.lines[0] ?? '').includes(`](adr/${name})`)) {
      failures.push(
        `${DECISIONS_DOC}:${entry.start + 1} is ${adrId(n)}, whose full text is ${doc}: link it from the headline (\`· [full text](adr/${name})\`).`
      )
    }
    const title = read(root, doc).split('\n')[0] ?? ''
    if (title === '---') {
      failures.push(
        `${doc} has front-matter. Drop it: an ADR's status is recorded once, in its entry under \`## Decisions\` in ${DECISIONS_DOC}.`
      )
    } else if (!title.startsWith(`# ${adrId(n)}: `)) {
      failures.push(`${doc} opens on "${title}"; its first line is \`# ${adrId(n)}: Title\`.`)
    }
  }
  return { count: seen.size, failures }
}

export function checkDecisions(root: string, floor: number = ADR_FLOOR): CheckResult {
  const failures: string[] = []
  if (!existsSync(join(root, DECISIONS_DOC))) {
    failures.push(`${DECISIONS_DOC}, which holds the ADRs, does not exist.`)
    return { ok: '', failures }
  }
  const source = read(root, DECISIONS_DOC)
  for (const [index, line] of source.split('\n').entries()) {
    if (/^#{1,6}\s+ADR-\d/.test(line)) {
      failures.push(
        `${DECISIONS_DOC}:${index + 1} heads an ADR. An ADR is a numbered entry under \`## Decisions\`, not a heading.`
      )
    }
  }
  const count = new Map<number, number>()
  for (const entry of entriesOf(source)) {
    if (entry.adr === undefined) continue
    const at = `${DECISIONS_DOC}:${entry.start + 1}`
    if (entry.section !== 'Decisions') {
      failures.push(`${at} is an ADR entry outside \`## Decisions\`. Move it there.`)
    } else if (entry.n !== entry.adr) {
      failures.push(`${at} numbers ${adrId(entry.adr)} as entry ${entry.n}. Entry N is ADR-N.`)
    }
    count.set(entry.adr, (count.get(entry.adr) ?? 0) + 1)
  }
  const retired = retiredAdrs(source)
  const folded = foldedAdrs(source)
  const highest = Math.max(floor, ...count.keys(), ...retired, ...folded.keys())
  for (let n = 1; n <= highest; n++) {
    const seen = count.get(n) ?? 0
    const areas = folded.get(n) ?? []
    const homes = [
      seen > 0 && 'as an entry',
      retired.has(n) && 'as retired',
      areas.length > 0 && 'as folded',
    ]
    if (homes.every((home) => home === false))
      failures.push(
        `${DECISIONS_DOC} has no ${adrId(n)} entry. ADRs are never renumbered: restore it, fold it into the Area that holds its rule (name it on that Area's headline), or name it on the \`Retired …:\` line if it is wholly superseded.`
      )
    const both = homes.filter((home) => home !== false)
    if (both.length > 1)
      failures.push(`${DECISIONS_DOC} lists ${adrId(n)} ${both.join(' and ')}. Keep one.`)
    if (areas.length > 1)
      failures.push(
        `${DECISIONS_DOC} folds ${adrId(n)} into ${areas.length} Areas (lines ${areas.join(', ')}). A rule lives once: name it on one Area's headline.`
      )
    if (seen > 1)
      failures.push(
        `${DECISIONS_DOC} lists ${adrId(n)} ${seen} times. Give the new decision the next number.`
      )
  }
  failures.push(...missingBackReferences(source))
  const files = adrFileFailures(root, source)
  failures.push(...files.failures)
  return {
    ok: `${count.size} live, ${folded.size} folded and ${retired.size} retired ADRs, ${adrId(1)} to ${adrId(highest)}, each once in ${DECISIONS_DOC}, every amendment named in the entry it amends; ${files.count} full-text ADR files, each linked from its entry`,
    failures,
  }
}
