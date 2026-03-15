# Full-Sweep Copy Audit Specification

## Purpose

Compare every entity in the `salvageunion-reference` JSON data files against their source PDFs for pinpoint text accuracy. Every field — name, content paragraphs, descriptions, page numbers, source attribution, stats, traits, action references — must match the source material exactly.

## Source PDFs

| ID | PDF File | Page Range | Entity Count |
|----|----------|------------|-------------|
| WM | `rules/Salvage Union Digital Edition 1.2.pdf` | 2–338 | 625 |
| FF | `rules/False Flag Digital Edition 1.1.pdf` | 8–71 | 39 |
| RM | `rules/Rainmaker Digital Edition 1.1.pdf` | 60–83 | 27 |
| WWHF | `rules/We Were Here First Digital Edition 1.1.pdf` | 9–79 | 47 |

## Data Files

All in `packages/salvageunion-reference/data/`:

abilities.json, ability-tree-requirements.json, actions.json, bio-titans.json, catalog-categories.json, chassis.json, classes.json, crawler-bays.json, crawler-tech-levels.json, crawlers.json, creatures.json, distances.json, drones.json, equipment.json, factions.json, guides.json, keywords.json, meld.json, modules.json, npcs.json, roll-tables.json, sources.json, squads.json, systems.json, tech-levels.json, traits.json, vehicles.json

## Phase 1: Audit (10 parallel agents)

Each auditor reads assigned PDF pages and compares against JSON entities whose `page` field falls within that range. For entities without page refs (actions), verify alongside the parent entity that references them.

### Batches

| Batch | Source | Pages | Focus |
|-------|--------|-------|-------|
| WM-1 | Workshop Manual | 2–50 | Classes, base ability trees, abilities |
| WM-2 | Workshop Manual | 51–100 | Hybrid classes, more abilities |
| WM-3 | Workshop Manual | 101–150 | Chassis, patterns |
| WM-4 | Workshop Manual | 151–200 | Systems (first half) |
| WM-5 | Workshop Manual | 201–250 | Systems (second half), modules |
| WM-6 | Workshop Manual | 251–300 | Modules, equipment, traits |
| WM-7 | Workshop Manual | 301–338 | Keywords, roll-tables, legendary abilities, misc |
| FF | False Flag | 8–71 | All False Flag entities |
| RM | Rainmaker | 60–83 | All Rainmaker entities |
| WWHF | We Were Here First | 9–79 | All WWHF entities |

### Auditor Instructions

1. Read the assigned PDF pages (20 pages per request, multiple requests as needed)
2. For each entity in the JSON data whose `page` falls in the range:
   - Compare `name` exactly
   - Compare all `content` blocks (paragraphs, lists, tables) word-for-word
   - Verify `page` number is correct
   - Verify `source` attribution
   - Verify stats, traits, action names, and any other structured fields
   - For actions referenced by name: verify action text on the same page
3. Output a markdown report to `docs/audit/audit-{batch-id}.md`

### Report Format

```markdown
# Audit Report: {Batch ID}

## Summary
- Pages reviewed: X–Y
- Entities checked: N
- Discrepancies found: M

## Discrepancies

| # | Entity Name | File | Field | PDF Value | JSON Value | Severity |
|---|-------------|------|-------|-----------|------------|----------|
| 1 | ... | ... | ... | ... | ... | typo/wrong-data/missing/extra |

## Entities Verified Clean
- Entity A (page X)
- Entity B (page Y)
- ...
```

Severities:
- `typo` — minor text difference (spelling, punctuation, whitespace)
- `wrong-data` — incorrect stat, page number, source, or structured field
- `missing` — content present in PDF but absent from JSON
- `extra` — content present in JSON but not in PDF

## Phase 2: Independent Review (10 parallel agents)

Each reviewer receives the same batch assignment as its corresponding auditor but NO access to the auditor's report. They independently:

1. Read the same PDF pages
2. Compare against the same JSON entities
3. Produce their own report to `docs/audit/review-{batch-id}.md`

Same report format as auditors.

## Phase 3: Reconciliation (1 agent)

Compares each auditor–reviewer pair:
- **Agreements** — both found the same issue → high confidence, queue for fix
- **Auditor-only** — auditor found it, reviewer didn't → needs human review
- **Reviewer-only** — reviewer found it, auditor didn't → needs human review
- Output: `docs/audit/RECONCILIATION.md` with categorized findings

## Phase 4: Fixes (parallel editor agents)

After human review of the reconciliation report:
- Editor agents apply confirmed fixes to the JSON data files
- Use text-level insertion to preserve formatting (never auto-format JSON arrays)
- Run `bun run validate:all` after all fixes applied
- Run `bun run build:package` to regenerate schemas
