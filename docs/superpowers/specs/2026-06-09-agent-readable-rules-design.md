# Agent-Readable Salvage Union Rules — Design

**Date:** 2026-06-09
**Status:** Approved (brainstorm) → implementation
**Audience:** Coding agents working in this repository

## Problem

The Salvage Union rules exist only as PDFs in `rules/` (gitignored): a 340-page
Core Rulebook (`Salvage Union Digital Edition 1.2.pdf`, ~60 MB), Quick Reference
Sheets, and three adventure modules. Any agent that needs to reference a rule
must re-read and re-parse a PDF every time — slow, token-heavy, and lossy.

Two gaps:

1. **No readable rules prose.** How the game actually works (turn structure,
   action economy, check resolution, the heat/combat loop, damage & conditions,
   downtime/salvage, creation rules) is not written anywhere an agent can read.
   It exists only as PDFs, as pure functions in `combatUtils.ts`, and as
   architecture docs.
2. **Scattered access.** 513+ structured items across 27 JSON files plus a TS
   ORM. There is no single index telling an agent what exists and where.

## Goal & Non-Goals

**Goal:** A coding agent can answer "how does rule X work?" by reading clean,
cross-linked markdown in the repo — never by re-parsing a PDF.

**Non-goals:**

- Re-encoding data that is already structured. Chassis, systems, abilities,
  equipment, actions, roll tables already live as schema-validated JSON in
  `packages/salvageunion-reference` and remain the source of truth.
- The three adventure modules (False Flag, Rainmaker, We Were Here First) are
  narrative scenarios. The digest covers only the **new rules subsystems** each
  adds (Meld Salvaging & Crafting; the Chimerium subsystem + meteor encounters;
  Rainmaker adds none) plus entity pointers — never the scenario/region prose.
- Committing any verbatim rules text to the repo (see Licensing).

## Constraints

- **No rules content in the repo — at all.** Neither the source PDFs, the raw
  text extract, NOR the condensed digest are committed. The PDFs/extract/briefs
  live under `rules/` and the digest under `docs/rules/`; both are gitignored.
  The digest is condensed from copyright-bearing PDFs, so it too stays out of git.
- **Only the generator is committed:** `tools/extract-rules.ts`,
  `tools/rules-digest/` (manifest + regenerate), plus discovery pointers and this
  spec. The digest is produced locally with `bun run rules:regen`.
- Work happens on a worktree branch and lands via PR.

## Approach: Hybrid (raw substrate + curated digest)

### Artifact A — Raw extract substrate (NOT committed)

- `tools/extract-rules.ts` (committed): a bun script wrapping `pdftotext` that
  extracts every PDF in `rules/` to `rules/extracted/<name>.txt`.
- Page boundaries are preserved as `<!-- page N -->` markers (pdftotext emits
  form-feeds between pages) so the curated layer can cite exact pages.
- Purpose: a greppable local full-text fallback AND the source material from
  which the curated digest is authored. Gitignored, regenerable, never in the PR.

### Artifact B — Curated mechanics digest (generated, NOT committed)

Location: `docs/rules/` (gitignored)

- `README.md` — index + a "where everything lives" map: which topics are prose
  here vs. which entities are structured JSON in `salvageunion-reference`.
  Includes the OGL attribution note. Generated from the manifest by `rules:regen`.
- Topic files covering only the connective mechanics prose not already in JSON:

  | File                          | Covers                                                                | Cross-links                               |
  | ----------------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
  | `00-overview.md`              | Core gameplay loop, the d20 Action Roll table, advantage/disadvantage | —                                         |
  | `01-turn-structure.md`        | Rounds, turns, AP, Turn/Free/Reaction actions                         | `data/actions.json`                       |
  | `02-checks-and-rolls.md`      | Action rolls, group actions, NPC reactions                            | —                                         |
  | `03-heat-and-pushing.md`      | Heat, heat cap, heat checks, pushing                                  | `combatUtils.ts`                          |
  | `04-damage-and-conditions.md` | SP/HP, critical damage, reactor overload, conditions                  | `combatUtils.ts`, `data/roll-tables.json` |
  | `05-combat.md`                | Combat flow, range/distance, cover, mech vs. pilot scale              | `data/distances.json`                     |
  | `06-pilots.md`                | Pilot creation, classes, abilities, ability trees, equipment, scrap   | `data/classes\|abilities\|equipment.json` |
  | `07-mechs.md`                 | Chassis, systems, modules, energy/heat/cargo, tech levels, SP         | `data/chassis\|systems\|modules.json`     |
  | `08-crawlers.md`              | Union Crawler, bays, tech levels, NPCs/squads                         | `data/crawlers\|crawler-bays.json`        |
  | `09-downtime-and-salvage.md`  | Downtime actions, salvage, scrap, bartering                           | —                                         |
  | `10-gm-guide.md`              | NPCs, factions, titans/meld/creatures, roll tables, safety tools      | `data/guides.json`, bestiary JSON         |

  The exact file set may consolidate during authoring; scale to content.

### Doc conventions (each curated file)

- Header line citing source pages, e.g. `Source: Core Rulebook pp. 40–48`.
- Concise, agent-oriented prose — mechanics, not lore.
- Structured-data callouts that link out instead of duplicating.
- Page citations into `rules/extracted/` for deep dives.

## Accuracy Gate

Raw `pdftotext` jumbles the Core Rulebook's two-column layout and garbles its
rotated stat-block sidebars. Therefore extraction is a draft, not truth: every
curated topic doc gets a **visual verification pass** — an agent reads the actual
PDF page range with the Read tool and confirms the prose matches before the doc
is accepted.

## Licensing

The repo ships `Salvage_Union_Open_Gaming_Licence_1.0a.pdf`. The digest is a
condensed mechanics reference (the purpose of an SRD), summarizing Open Game
Content rather than reproducing the book. `docs/rules/README.md` carries the
attribution/licence note.

## Discovery & Maintenance

- Pointer added to `docs/README.md` and a one-liner in `CLAUDE.md` so agents
  discover `docs/rules/`.
- Regeneration is a committed, manifest-driven dev tool:
  - `tools/extract-rules.ts` — deterministic PDF → text extraction (`bun run rules:extract`).
  - `tools/rules-digest/manifest.ts` — the reusable page-map + per-doc scope +
    cross-links (the knowledge that maps source pages to each digest doc).
  - `tools/rules-digest/regenerate.ts` — refreshes the extract and emits a
    ready-to-run authoring brief per doc (scope + cited pages + inlined source
    text) to `rules/extracted/briefs/` (gitignored). `bun run rules:regen`.
  - Extraction is fully automated; authoring each doc remains an LLM step with a
    visual PDF-verification gate, so the tool prepares the briefs and an agent
    writes each `docs/rules/<slug>.md`. The README index/licence note is
    hand-maintained.
- Curated digest is page-cited, so it is re-verifiable against future PDF editions.

## Out of Scope (v1)

- Scenario/region/adventure narrative from any module (digest covers rules only).
- An MCP server / runtime API over the rules (the digest is static markdown).
- Any change to the `salvageunion-reference` data or schemas.
