/**
 * Regenerate the agent-readable rules digest (`docs/rules/`) from the source PDFs.
 *
 * The digest is gitignored (condensed from copyright-bearing PDFs); only this
 * tooling is committed. Regeneration is two steps, one deterministic and one
 * LLM-driven:
 *   1. extract  — `pdftotext` over the PDFs in `rules/` (fully automated).
 *   2. briefs   — write the digest index (docs/rules/README.md) and a ready-to-
 *                 run authoring brief per topic doc. An agent then authors each
 *                 docs/rules/<slug>.md from its brief, verifying against the
 *                 source PDF pages (the accuracy gate).
 *
 * The curated prose can't be produced by a pure script — it is summarization +
 * visual verification. This tool makes that repeatable: the page-map and per-doc
 * scope live in `manifest.ts`, and the briefs assemble the exact context each
 * authoring agent needs.
 *
 * Usage:
 *   bun tools/rules-digest/regenerate.ts            # extract + briefs + index
 *   bun tools/rules-digest/regenerate.ts extract    # extract only
 *   bun tools/rules-digest/regenerate.ts briefs     # briefs + index (extract must exist)
 *
 * Env: RULES_DIR overrides the PDF/extract dir (default `rules`).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { extractAll } from '../extract-rules'
import { manifest, SOURCE_PDF, type DocSpec } from './manifest'

const rulesDir = process.env.RULES_DIR ?? 'rules'
const briefsDir = join(rulesDir, 'extracted', 'briefs')
const digestDir = 'docs/rules'
const cmd = process.argv[2] ?? 'all'

const extractFileFor = (pdf: string) =>
  join(rulesDir, 'extracted', `${pdf}.txt`)

const pageMapCache = new Map<string, Map<number, string>>()
function pageMap(pdf: string): Map<number, string> {
  const cached = pageMapCache.get(pdf)
  if (cached) return cached
  const raw = readFileSync(extractFileFor(pdf), 'utf8')
  const parts = raw.split(/<!-- page (\d+) -->/)
  const map = new Map<number, string>()
  for (let i = 1; i < parts.length; i += 2) {
    map.set(Number(parts[i]), (parts[i + 1] ?? '').trim())
  }
  pageMapCache.set(pdf, map)
  return map
}

function renderLink(l: string): string {
  if (l.startsWith('data/')) return `\`packages/salvageunion-reference/${l}\``
  if (l === 'combatUtils.ts')
    return '`packages/salvageunion-reference/lib/combatUtils.ts`'
  return `\`${l}\`` // sibling docs, incl. ../ relative paths
}

function renderBrief(spec: DocSpec): string {
  const pdf = spec.sourcePdf ?? SOURCE_PDF
  const pages = pageMap(pdf)
  const links = spec.crossLinks.map(renderLink).join(', ')
  const source = spec.extractPages
    .map(
      (p) =>
        `<!-- page ${p} -->\n${pages.get(p) ?? '(page not found in extract)'}`,
    )
    .join('\n\n')

  return `# Regeneration brief — docs/rules/${spec.slug}.md

Write \`docs/rules/${spec.slug}.md\`.

## Conventions
- First line \`# ${spec.title}\`, then a blank line, then \`_Source: ${spec.sourceLabel}._\`
- Concise, agent-oriented; mechanics, not lore. Paraphrase and condense — this is
  an OGL summary, not a reproduction. No padding. Tables where they aid scanning.
- Cross-link, never enumerate entities. Relevant links: ${links}

## Scope
${spec.brief}

## Accuracy gate (required)
Before writing, verify against the source PDF: Read \`${rulesDir}/${pdf}.pdf\`
pages "${spec.verifyPages}". The extracted text below is a jumbled draft
(two-column layout, rotated stat blocks); the PDF is authoritative.

## Extracted source text (draft — verify against the PDF)
${source}
`
}

// Static (non-rules) header for the generated digest index. The topic table is
// generated from the manifest; everything here is tooling, not reproduced rules.
const README_HEADER = `# Salvage Union Rules — Agent Reference

A condensed, agent-readable digest of the **Salvage Union** core rules. Read these
markdown files instead of re-parsing the source PDFs.

> **Generated, not committed.** This digest is condensed from copyright-bearing
> PDFs and is gitignored (\`docs/rules/\`). It is produced locally by
> \`bun run rules:regen\` (page-map in \`tools/rules-digest/manifest.ts\`); only the
> tooling lives in git. Source PDFs live in \`rules/\` (also gitignored).

This digest covers the _connective mechanics prose_ — how the game actually
works. It deliberately does **not** re-list specific game entities (classes,
chassis, systems, abilities, equipment, NPCs); those are already structured,
schema-validated JSON in the \`salvageunion-reference\` package. See the map below.

> **Source & licence.** Derived from _Salvage Union_ (Leyline Press, ©2023 Aled
> Lawlor & Panayiotis Lines) and its expansions, under the Salvage Union Open
> Gaming Licence 1.0a (\`packages/salvageunion-reference/Salvage_Union_Open_Gaming_Licence_1.0a.pdf\`).
> These docs summarize Open Game Content; they are not a reproduction of the books.
`

const README_MAP = `## Where everything lives

Mechanics prose → these docs. Specific game entities → structured JSON in
\`packages/salvageunion-reference\` (import via \`SalvageUnionReference.<Model>\` or
read \`packages/salvageunion-reference/data/<file>.json\` directly). Expansion
content is source-tagged (filter by \`source\`).

| You want… | Structured source |
|-----------|-------------------|
| Pilot classes & ability trees | \`classes.json\`, \`abilities.json\`, \`ability-tree-requirements.json\` |
| Pilot equipment | \`equipment.json\` |
| Mech chassis / systems / modules | \`chassis.json\`, \`systems.json\`, \`modules.json\` |
| Actions (the action library) | \`actions.json\` |
| Union Crawler & bays | \`crawlers.json\`, \`crawler-bays.json\`, \`crawler-tech-levels.json\` |
| Roll tables (incl. Chimerium, Meld, encounters) | \`roll-tables.json\` |
| Distances / range bands | \`distances.json\` |
| Tech levels | \`tech-levels.json\` |
| Keywords & traits | \`keywords.json\`, \`traits.json\` |
| Bestiary (titans, meld, creatures, drones, vehicles) | \`bio-titans.json\`, \`meld.json\`, \`creatures.json\`, \`drones.json\`, \`vehicles.json\` |
| NPCs, squads, factions | \`npcs.json\`, \`squads.json\`, \`factions.json\` |
| Safety tools & guides | \`guides.json\` |
| Combat math (heat/damage/condition functions) | \`packages/salvageunion-reference/lib/combatUtils.ts\` |

## Regenerating this digest

\`\`\`bash
bun run rules:extract   # PDFs → rules/extracted/*.txt  (deterministic)
bun run rules:regen     # extract + this index + per-doc authoring briefs
\`\`\`

Extraction is automated; authoring each doc is an LLM step with a visual
PDF-verification gate, so \`rules:regen\` writes a ready-to-run brief per doc
(scope + cited pages + inlined source text) to \`rules/extracted/briefs/\`, and an
agent writes each \`docs/rules/<slug>.md\` from it. This index is generated from
\`tools/rules-digest/manifest.ts\`.
`

function renderReadme(): string {
  const core = manifest.filter((s) => !s.slug.startsWith('expansions/'))
  const exp = manifest.filter((s) => s.slug.startsWith('expansions/'))
  const row = (s: DocSpec) =>
    `| [${s.slug}.md](${s.slug}.md) | ${s.title} | ${s.sourceLabel.replace(/\|/g, '\\|')} |`
  const coreTable = [
    '## Topics',
    '',
    '| Doc | Title | Source |',
    '|-----|-------|--------|',
    ...core.map(row),
  ].join('\n')
  const expTable = exp.length
    ? [
        '',
        '## Expansions',
        '',
        'New rules subsystems each adventure module adds. Entities/tables are source-tagged in the data package.',
        '',
        '| Doc | Module | Adds |',
        '|-----|--------|------|',
        ...exp.map(row),
      ].join('\n')
    : ''
  return [README_HEADER, coreTable, expTable, '', README_MAP].join('\n')
}

async function main() {
  if (cmd === 'extract' || cmd === 'all') {
    await extractAll(rulesDir)
  }
  if (cmd === 'briefs' || cmd === 'all') {
    mkdirSync(briefsDir, { recursive: true })
    mkdirSync(digestDir, { recursive: true })
    writeFileSync(join(digestDir, 'README.md'), renderReadme())
    console.log(`index → ${join(digestDir, 'README.md')}`)
    for (const spec of manifest) {
      const dest = join(briefsDir, `${spec.slug}.md`)
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, renderBrief(spec))
      console.log(`brief → ${dest}`)
    }
    console.log(
      `\n${manifest.length} briefs written to ${briefsDir}/ (gitignored).\n` +
        `Dispatch one authoring agent per brief: each reads its brief, verifies\n` +
        `against the cited PDF pages, and writes docs/rules/<slug>.md (gitignored).\n` +
        `The index docs/rules/README.md is generated from the manifest.`,
    )
  }
  if (!['extract', 'briefs', 'all'].includes(cmd)) {
    console.error(`Unknown command "${cmd}". Use: extract | briefs | all`)
    process.exit(1)
  }
}

await main()
