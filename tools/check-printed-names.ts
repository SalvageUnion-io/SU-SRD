/**
 * Cross-checks every entity's `name` and `page` against the Core Book's own
 * index — the book's authoritative name → page map.
 *
 * This replaces an earlier substring scan that compared each entity's name
 * against the text of the page it cited. That approach had two flaws that this
 * one does not:
 *
 *   1. A name contained in a longer name passed silently. "Sniper Rifle" was
 *      found on the page it cited only because "Custom Sniper Rifle" appeared
 *      there, so its genuinely wrong page reference went unreported.
 *   2. A page mention counted as an entry. Items are named all over the book —
 *      in class trees, pattern loadouts and summary tables — so citing any page
 *      that merely mentions the item looked correct.
 *
 * The index sidesteps both: it is an exact-name lookup that yields the page the
 * book itself considers definitive. But the index is not infallible either — it
 * is off by one for a run of entries in the Systems and Modules chapters — so a
 * disagreement is put to the page itself before being called a data bug. Three
 * classes fall out, reported separately because they need different responses:
 *
 *   PAGE MISMATCH — the index disagrees AND the cited page does not print the
 *     name. The data is wrong; take the index's page.
 *   INDEX SUSPECT — the index disagrees but the cited page prints the name as a
 *     heading. The data is corroborated and the index is the one that is off.
 *     No action; this class exists so those entries stop being reported as bugs.
 *   NAME NOT IN INDEX — the dataset name is not printed. Either a deliberate
 *     deviation or a typo. The tool suggests candidates by reporting which
 *     index entries point at the page the entity cites.
 *
 * Two kinds of non-finding are counted rather than listed, because listing them
 * is what turns a diagnostic into something people stop reading:
 *
 *   - The book's index is not a complete list of its own contents. A name that
 *     is missing from it but printed on the page it cites is simply unindexed,
 *     and fine.
 *   - A name already ruled on and recorded in
 *     `packages/salvageunion-reference/lib/printedNameDeviations.ts` has been
 *     looked at, with a reason. That list is shared with the test that enforces
 *     it, so recording a deviation both protects it and silences it here.
 *
 * Together those took this scan's name findings from 29 to 1 without loosening
 * a single check.
 *
 * Everything here is advisory. The index parse and the heading test are both
 * heuristics over a PDF text layer; read the findings, do not apply them blind.
 * The known false positive is an all-caps stylised entry ("AARDVARKS TONGUE",
 * p. 202) whose heading the text layer interleaves with body copy, so it never
 * occupies a line of its own.
 *
 * Requires the gitignored PDF extract: `bun tools/extract-rules.ts` first. With
 * no extract present this exits 0 with a notice — it is a local diagnostic, not
 * a CI gate, because the copyright-bearing PDFs are not available to CI.
 *
 * Run:  bun tools/check-printed-names.ts
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SalvageUnionReference } from '../packages/salvageunion-reference/lib/index'
import { DEVIATIONS } from '../packages/salvageunion-reference/lib/printedNameDeviations'

const EXTRACT_DIR = 'rules/extracted'
/** Entities carrying this `source` are printed in the Core Book. */
const CORE_SOURCE = 'Salvage Union Workshop Manual'

/**
 * Normalise for comparison.
 *
 * The book's index is typeset without the punctuation the dataset carries, so a
 * literal comparison reports dozens of non-differences: the index prints "self
 * destruct" for "Self-Destruct", "auto repair droid" for "Auto-Repair Droid",
 * "adv targeting array" for "Adv. Targeting Array", and a plain "2" for the
 * subscript in "He₂". Hyphens and periods are folded to spaces and subscript
 * digits to ASCII so only real name differences survive.
 */
function norm(s: string): string {
  return s
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/-\s*\n\s*/g, '')
    .replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
    .replace(/[.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Split an extract into `page number -> text`, using the `<!-- page N -->` markers. */
function pagesOf(text: string): Map<number, string> {
  const out = new Map<number, string>()
  const parts = text.split(/<!-- page (\d+) -->/)
  for (let i = 1; i < parts.length; i += 2) {
    out.set(Number(parts[i]), parts[i + 1] ?? '')
  }
  return out
}

/**
 * Parse the book's index into `normalised name -> pages`.
 *
 * Index pages are found by shape rather than by hardcoded page numbers, so this
 * survives a repaginated edition: an index page is one where most non-blank
 * lines look like `Some Entry, 123`.
 *
 * Long entries wrap, and the page number lands on the continuation line:
 *
 *     Refractive Shield
 *     Projector, 171
 *
 * Read line-by-line that registers an entry called "Projector", which then
 * matches nothing and makes every genuinely-unindexed name look like it sits on
 * a page full of one-word entries. Lines without a trailing page number are
 * therefore held and prepended to the line that has one.
 */
function parseIndex(pages: Map<number, string>): Map<string, number[]> {
  // An entry may cite several pages ("Mech Melee Armament, 110,127") and any of
  // them may be a range ("Persona, 49-50"). Both forms must be recognised, or
  // the name keeps a page number glued to it — and worse, an entry ending in a
  // range fails to match at all, so it is treated as a wrapped entry's first
  // half and glued onto the NEXT entry ("persona, 49 50 personal recreation
  // device"). That one omission accounted for most of the false "not in index"
  // reports.
  const PAGES = String.raw`\d{1,3}(?:\s*[-–—]\s*\d{1,3})?`
  const ENTRY = new RegExp(String.raw`^(.+?),\s*(${PAGES}(?:\s*,\s*${PAGES})*)$`)
  // Alphabet headings ("D", "0-9") sit on their own line exactly where a wrapped
  // entry's first half would, and would otherwise be glued onto the next entry.
  const HEADING = /^(?:[A-Z]|[0-9]\s*-\s*[0-9])$/
  const index = new Map<string, number[]>()
  for (const [, raw] of pages) {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length < 10) continue
    const entries = lines.filter((l) => ENTRY.test(l))
    // An index page is overwhelmingly entries; a prose page is not.
    if (entries.length / lines.length < 0.6) continue
    let carry = ''
    for (const line of lines) {
      if (!ENTRY.test(line)) {
        // A wrapped entry's first half. Two in a row means the second is a new
        // entry's opening, not a continuation of the first.
        carry = HEADING.test(line) ? '' : line
        continue
      }
      const m = `${carry ? `${carry} ` : ''}${line}`.match(ENTRY)
      carry = ''
      if (!m) continue
      const key = norm(m[1])
      if (!key) continue
      const list = index.get(key) ?? []
      for (const part of m[2].split(',')) {
        const [from, to] = part.split(/[-–—]/).map((n) => Number(n.trim()))
        // A range is expanded so that citing any page within it counts as a hit.
        for (let p = from; p <= (Number.isFinite(to) ? to : from); p++) list.push(p)
      }
      index.set(key, list)
    }
  }
  return index
}

/**
 * Does this page actually print this name, as a whole name rather than inside a
 * longer one?
 *
 * A word-boundary anchor alone is not enough. "Sniper Rifle" sits inside "Custom
 * Sniper Rifle" with a space before it, so it clears any boundary test while
 * being nothing but the tail of a different item — the exact conflation that hid
 * a wrong page reference from the first version of this scan, and that reappeared
 * the moment this corroboration step was added.
 *
 * Nor is erasing longer names enough on its own: p. 47 says "gain a specialised
 * sniper rifle that only you can use", a prose mention with no longer name
 * around it, which would still read as proof that the Sniper Rifle entry lives
 * there.
 *
 * What separates an entry from a mention is layout — a heading occupies its own
 * line. The text layer has no heading markup, but it does preserve line breaks,
 * so the test is line equality rather than containment. Adjacent line pairs are
 * also joined, because a long heading wraps ("Portable / Communications Unit").
 *
 * This is a heuristic, not an oracle: it answers "is the cited page plausibly
 * the entry page", and its findings are meant to be looked at, not applied.
 */
function printsName(pageText: string | undefined, name: string): boolean {
  if (!pageText) return false
  const needle = norm(name)
  const lines = pageText
    .split('\n')
    .map((l) => norm(l))
    .filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === needle) return true
    if (i + 1 < lines.length && `${lines[i]} ${lines[i + 1]}` === needle) return true
  }
  return false
}

type Finding = {
  kind: 'page' | 'index-suspect' | 'name'
  schema: string
  name: string
  cited: number
  detail: string
}

async function main() {
  if (!existsSync(EXTRACT_DIR)) {
    console.log(
      `No ${EXTRACT_DIR}/ — run \`bun tools/extract-rules.ts\` first (needs the PDFs in rules/).`
    )
    return
  }
  const coreFile = readdirSync(EXTRACT_DIR).find((f) => /core book/i.test(f))
  if (!coreFile) {
    console.log(`No Core Book extract in ${EXTRACT_DIR}/ — nothing to check against.`)
    return
  }

  const pages = pagesOf(readFileSync(join(EXTRACT_DIR, coreFile), 'utf8'))
  const index = parseIndex(pages)
  if (index.size < 100) {
    console.log(
      `Parsed only ${index.size} index entries — the index heuristic did not match. Aborting.`
    )
    return
  }
  /** page -> names the index files under it, for suggesting a printed name. */
  const byPage = new Map<number, string[]>()
  for (const [name, ps] of index)
    for (const p of ps) byPage.set(p, [...(byPage.get(p) ?? []), name])

  await SalvageUnionReference.preload('all')
  const SCHEMAS = ['Modules', 'Systems', 'Equipment'] as const

  const findings: Finding[] = []
  let checked = 0
  /** Names absent from the index but printed on their cited page — fine, not reported. */
  let unindexed = 0
  /** Names already recorded as deliberate deviations — suppressed, not reported. */
  let known = 0
  const recorded = new Set(DEVIATIONS.map((d) => d.name))
  for (const schema of SCHEMAS) {
    for (const entity of SalvageUnionReference[schema].all()) {
      if (!('name' in entity) || typeof entity.name !== 'string') continue
      if (!('source' in entity) || entity.source !== CORE_SOURCE) continue
      if (!('page' in entity) || typeof entity.page !== 'number') continue
      checked++
      const cited = entity.page
      const indexed = index.get(norm(entity.name))
      if (!indexed) {
        // The book's index is not a complete list of its own contents — plenty
        // of real entries are simply missing from it. So "not indexed" on its
        // own says nothing. Ask the page: if it prints the name as a heading,
        // the entity is fine and merely unindexed, and reporting it is noise
        // that buries the handful of names that really do differ.
        if (printsName(pages.get(cited), entity.name)) {
          unindexed++
          continue
        }
        // Already ruled on and recorded, with a reason, in
        // lib/printedNameDeviations.ts. Re-reporting these every run is what
        // makes a diagnostic get ignored — the output should only ever be
        // things nobody has looked at yet.
        if (recorded.has(entity.name)) {
          known++
          continue
        }
        const printed = (byPage.get(cited) ?? []).slice(0, 4)
        findings.push({
          kind: 'name',
          schema,
          name: entity.name,
          cited,
          detail: printed.length
            ? `p${cited} is indexed as: ${printed.join(' | ')}`
            : `nothing indexed on p${cited}`,
        })
      } else if (!indexed.includes(cited)) {
        // The index is not infallible: through the Systems and Modules chapters
        // it is off by one for a run of entries, and blindly "correcting" the
        // data to it would move a dozen right answers to wrong pages. So ask the
        // page itself who is right — if the cited page prints the name, the data
        // is corroborated and the index is the one that is off.
        const corroborated = printsName(pages.get(cited), entity.name)
        findings.push({
          kind: corroborated ? 'index-suspect' : 'page',
          schema,
          name: entity.name,
          cited,
          detail: corroborated
            ? `p${cited} prints this name; index says p${indexed.join(', p')} — index looks wrong, data left alone`
            : `index says p${indexed.join(', p')}`,
        })
      }
    }
  }

  console.log(`Parsed ${index.size} index entries from ${coreFile}`)
  console.log(
    `Checked ${checked} Core Book entities (${unindexed} unindexed but printed on their cited page, ${known} recorded deviations)\n`
  )
  const LABELS = {
    page: 'PAGE MISMATCH (name not on the cited page — data is wrong)',
    'index-suspect':
      "INDEX SUSPECT (cited page prints the name — the book's index is off; no action)",
    name: 'NAME NOT IN INDEX (deliberate deviation, or a typo)',
  } as const
  for (const kind of ['page', 'index-suspect', 'name'] as const) {
    const rows = findings.filter((f) => f.kind === kind)
    const label = LABELS[kind]
    console.log(`${label}: ${rows.length}`)
    for (const f of rows)
      console.log(`  ${f.schema.padEnd(10)} ${f.name} — cited p${f.cited}; ${f.detail}`)
    console.log()
  }
}

await main()
