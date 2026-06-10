# SRD Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement every confirmed finding from the 2026-06-09 multi-agent audit of salvageunion.io, plus deprecate the salvageunion-reference npm publication, on branch `worktree-srd-audit`.

**Architecture:** The work is 21 independent tasks across three surfaces: the `salvageunion-reference` package (data, Zod schemas, validation tooling, npm deprecation), the `suref-web` Astro app (search, UX, SEO, bundle, PWA), and repo-level DX (tsconfig, lefthook, CI pins, docs). Tasks are ordered so destructive/structural changes (deprecation, dead code, schema tightening) land before behavior changes that build on them (bundle slimming before PWA precache). Each task is committable on its own; run `bun run typecheck && bun test` per task, full `/validate` at the end.

**Tech Stack:** Bun monorepo, Astro 5 + React 19 islands, Tailwind v4, Zod, Netlify static hosting.

**Conventions that bind every task:** relative imports only; `type` over `interface`; no `any`; named exports; conventional commits; JSON data files are edited at TEXT level (never reformat via a JSON serializer — preserve existing formatting exactly); `bun run build:package` after any change under `packages/salvageunion-reference/lib/` or `data/`.

**Operator-gated steps** (need credentials or publisher contact; the executor skips them and leaves them on the task list):
- `npm deprecate` / `npm unpublish` (npm auth)
- Obtaining the Salvage Union OGL **1.0b** licence text if WebFetch of the leyline.press page is blocked
- Emailing Leyline Press re: Mech Monday / Starter Set rights

---

## Task 1: Deprecate the salvageunion-reference npm publication

**Files:**
- Modify: `packages/salvageunion-reference/package.json`
- Modify: `packages/salvageunion-reference/README.md`

The workspace package stays (all four workspaces depend on it via `workspace:*`). We are only ending the npm publication (~346 downloads/month ≈ bot noise; the site's JSON API at `/schema/{id}.json` supersedes it).

- [ ] **Step 1: Mark the package private and remove publish tooling**

In `packages/salvageunion-reference/package.json`, add `"private": true` directly under `"version"` and delete the `prepublishOnly` script line:

```json
  "name": "salvageunion-reference",
  "version": "2.3.5",
  "private": true,
```

Delete this line from `"scripts"`:

```json
    "prepublishOnly": "bun run build && bun run typecheck",
```

- [ ] **Step 2: Add a deprecation notice to the package README**

At the top of `packages/salvageunion-reference/README.md`, immediately after the title, insert:

```markdown
> **npm deprecation notice:** This package is no longer published to npm. The
> same dataset and JSON Schemas are served publicly (CORS-enabled) at
> `https://salvageunion.io/schema/{schemaId}.json` — see
> https://salvageunion.io/llms.txt for the full endpoint list. Within this
> monorepo the package is consumed via `workspace:*` and is unaffected.
```

- [ ] **Step 3: Verify nothing in the repo depends on the npm (non-workspace) copy**

Run: `grep -rn '"salvageunion-reference"' apps/*/package.json packages/*/package.json | grep -v workspace`
Expected: no output.

Run: `bun install && bun run typecheck`
Expected: PASS (private flag does not affect workspace resolution).

- [ ] **Step 4: Commit**

```bash
git add packages/salvageunion-reference/package.json packages/salvageunion-reference/README.md
git commit -m "chore(salvageunion-reference): mark private, end npm publication"
```

- [ ] **Step 5 (OPERATOR — skip if no npm auth):** Run from any machine with npm owner rights:

```bash
npm deprecate salvageunion-reference "Data now served at https://salvageunion.io/schema/{id}.json — see https://salvageunion.io/llms.txt"
# optional, only if npm's unpublish policy allows:
npm unpublish salvageunion-reference --force
```

---

## Task 2: Licensing compliance — ship the licence you claim

**Files:**
- Create: `packages/salvageunion-reference/LICENCE`
- Modify: `packages/salvageunion-reference/package.json`
- Modify: `apps/suref-web/src/pages/api.astro:229-250`
- Modify: `apps/suref-web/public/llms.txt:33-36` (until Task 14 converts it to a route)

Background: the only licence text in the repo is the OGL **1.0a** PDF, under which verbatim SRD text is prohibited; the site's legality rests on **1.0b**'s reference exception, whose text is archived nowhere. `api.astro` and `llms.txt` also over-grant: they imply `asset_url` art is OGL-licensed, but the licence excludes art (the site's art use is special permission — see `packages/suref-react/src/components/shared/Footer.tsx:38-46`).

- [ ] **Step 1: Obtain the 1.0b licence text**

Try: `WebFetch https://leyline.press/pages/salvage-union-open-game-licence-1-0b` (note: `leyline.press` may be outside the sandbox network allowlist — `www.salvageunionworkshop.com` and `leyline-press.itch.io` are allowed and may mirror it).
If fetch succeeds: save the licence body verbatim (plain text) as `packages/salvageunion-reference/LICENCE`, with a one-line header citing the source URL and retrieval date (2026-06-09).
If blocked: create the file containing only the header + `TODO(operator): paste OGL 1.0b text from <url>` and add an operator task — do NOT silently skip.

- [ ] **Step 2: Point the package licence field at the file**

In `packages/salvageunion-reference/package.json`, change the existing `"license"` value to:

```json
  "license": "SEE LICENSE IN LICENCE",
```

Also update `"files"`: replace the `"LICENSE"` entry with `"LICENCE"` (the array currently lists a `LICENSE` file that has never existed). While in this file, fix the `repository` field if it points anywhere other than `https://github.com/alxjrvs/SU-SRD` (verify with `git remote get-url origin`).

- [ ] **Step 3: Correct the API licensing section**

In `apps/suref-web/src/pages/api.astro`, in the Licensing section (~lines 229-250): change the licence link `href` from `https://leyline.press` to `https://leyline.press/pages/salvage-union-open-game-licence-1-0b` (the URL already used in `Footer.tsx:29`), and append a new paragraph after the existing one:

```astro
        <p>
          The licence covers game text and mechanics only. Artwork referenced
          by <code class="rounded bg-su-blue-pale px-1 py-0.5">asset_url</code>{' '}
          fields is <strong>not</strong> covered — those images are used on this
          site with special permission from Leyline Press and may not be
          redistributed. Republication of licensed text must include the legal
          notices required by the Salvage Union Open Game Licence 1.0b.
        </p>
```

- [ ] **Step 4: Mirror the same clarification in llms.txt**

In `apps/suref-web/public/llms.txt`, replace the Licensing section body (lines 34-35) with:

```text
Game text and mechanics are published under the Salvage Union Open Game Licence (OGL 1.0b): https://leyline.press/pages/salvage-union-open-game-licence-1-0b
Artwork (asset_url fields) is NOT covered by the licence — used with special permission of Leyline Press; do not redistribute.
Republication of licensed text must include the legal notices required by OGL 1.0b.
Salvage Union is created and published by Leyline Press (https://leyline.press).
```

- [ ] **Step 5: Verify and commit**

Run: `bun --filter suref-web test && bun run typecheck`
Expected: PASS.

```bash
git add packages/salvageunion-reference/LICENCE packages/salvageunion-reference/package.json apps/suref-web/src/pages/api.astro apps/suref-web/public/llms.txt
git commit -m "fix(licensing): archive OGL 1.0b text, correct art-exclusion claims in API docs"
```

---

## Task 3: Dead-code deletions

**Files:**
- Delete: `apps/suref-web/src/lib/structuredData.ts` (120 lines), `apps/suref-web/src/lib/__tests__/structuredData.test.ts` (186 lines)
- Delete: `packages/salvageunion-reference/lib/query.ts` (72 lines), `packages/salvageunion-reference/lib/query.test.ts` (231 lines)
- Modify: `packages/salvageunion-reference/lib/index.test.ts:~41-43`
- Maybe modify: `packages/suref-react/src/styles/theme.css`, `packages/suref-react/src/**/Theme.stories.tsx`

- [ ] **Step 1: Cherry-pick the existing structuredData deletion commit**

```bash
git cherry-pick d06cd501
```

Commit `d06cd501` (`fix(suref-web): delete unused structuredData.ts helpers and tests`, on `scram/suref-web-cleanup`) deletes exactly these two files. If the cherry-pick conflicts, abort it and `git rm` the two files directly instead.

- [ ] **Step 2: Delete query.ts and its test**

`lib/query.ts` exports `isValidSchemaName`, `filterByTechLevel`, `filterBySource` — verified absent from the `lib/index.ts` barrel and the package exports map; only the test consumes it.

```bash
git rm packages/salvageunion-reference/lib/query.ts packages/salvageunion-reference/lib/query.test.ts
```

Then in `packages/salvageunion-reference/lib/index.test.ts`, find the expected-API name list (~lines 35-47) and delete the three lines `'isValidSchemaName',`, `'filterByTechLevel',`, `'filterBySource',`.

- [ ] **Step 3: Verify the theme-token claim before deleting anything**

The audit flagged 14 dead tokens in `packages/suref-react/src/styles/theme.css` (lines 18-19, 22, 35-36, 50-51, 55, 57, 61-65); a follow-up read disputed this. Adjudicate with evidence: for each custom property defined in that file, run

```bash
grep -rn -- '--<token-name>' apps packages --include='*.{ts,tsx,css,astro}' | grep -v 'theme.css'
```

Also note Tailwind v4 derives utilities from `@theme` tokens (`--color-su-orange` → `text-su-orange`), so ALSO grep for the derived utility name (e.g. `su-orange`). Delete only tokens with zero hits under both greps, and update any hardcoded hex swatches in `Theme.stories.tsx` that referenced them to `var()` refs. If everything is used, skip — record that in the commit message of Step 5.

- [ ] **Step 4: Sweep remaining unused package exports with knip**

Now that the package is private (Task 1), unused exports are dead code, not public API. Run: `bun run knip`. For each reported unused export in `packages/salvageunion-reference/lib/helpers.ts` and `lib/contentBlockHelpers.ts` (e.g. `getParagraphString` — re-exported at `lib/index.ts:72`, never called anywhere in the monorepo): remove the export (and the barrel re-export), keeping any function that is used internally as non-exported. Do not remove anything knip does not flag.

- [ ] **Step 5: Rebuild, test, commit**

Run: `bun run build:package && bun run typecheck && bun test`
Expected: PASS (the deleted names appear in no other test).

```bash
git add -A
git commit -m "chore: delete dead code — structuredData, query helpers, unused package exports"
```

---

## Task 4: Trait data — fix dangling references, add vocabulary validation

**Files:**
- Modify: `packages/salvageunion-reference/data/actions.json` (6 line-level edits)
- Modify: `packages/salvageunion-reference/tools/validateTraitsLogic.ts`
- Test: `packages/salvageunion-reference/tools/validateTraitsLogic.test.ts` (create if absent; check for an existing test file first)

`traits.json` defines `armour` (line 62); `actions.json` uses `"type": "armor"` six times, so `TraitKeywordDisplayView` silently renders plain text with no tooltip.

- [ ] **Step 1: Write the failing vocabulary test**

Add to the validateTraitsLogic test file:

```typescript
import { describe, test, expect } from 'bun:test'
import { findUnknownTraitTypes } from './validateTraitsLogic'

describe('findUnknownTraitTypes', () => {
  test('flags trait types defined in neither traits.json nor keywords.json', () => {
    const issues = findUnknownTraitTypes()
    const types = issues.map((i) => i.type)
    expect(types).toContain('armor') // misspelling of 'armour'
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun --filter salvageunion-reference test validateTraitsLogic`
Expected: FAIL — `findUnknownTraitTypes` is not exported.

- [ ] **Step 3: Implement the vocabulary check**

In `tools/validateTraitsLogic.ts`, add (following the existing `findTraitCasingIssues` pattern — reuse its data-loading approach and the existing `collectTraitTypes()`):

```typescript
/** Trait types that intentionally resolve via keywords.json or are pending
 *  trait definitions sourced from the books. Shrink this list over time. */
const KNOWN_NON_TRAIT_TYPES = new Set([
  // resolve via keywords.json:
  'irradiated',
  'pilot equipment',
  'wheeled',
  // pending definitions (see Task 4 Step 6):
  'reliable',
  'deployable',
  'bio-equipment',
  'meld infection',
])

export type UnknownTraitType = { type: string; file: string; entityName: string }

export function findUnknownTraitTypes(): UnknownTraitType[] {
  const defined = new Set([
    ...traitNames(), // names from traits.json — reuse/extract from collectTraitTypes()
    ...keywordNames(), // names from keywords.json
  ])
  const issues: UnknownTraitType[] = []
  for (const { type, file, entityName } of allTraitUsages()) {
    if (!defined.has(type) && !KNOWN_NON_TRAIT_TYPES.has(type)) {
      issues.push({ type, file, entityName })
    }
  }
  return issues
}
```

(`traitNames`/`keywordNames`/`allTraitUsages` — implement against the same data imports the file already uses; `collectTraitTypes()` at line 37 already walks usages, extend rather than duplicate.) Wire `findUnknownTraitTypes` into `findTraitIssues()` (line 134) so `bun run validate:all` fails on future dangling types.

- [ ] **Step 4: Run test — `armor` is flagged**

Run: `bun --filter salvageunion-reference test validateTraitsLogic`
Expected: PASS.

- [ ] **Step 5: Fix the six `armor` → `armour` data lines**

Text-level edits in `packages/salvageunion-reference/data/actions.json` — change `"type": "armor"` to `"type": "armour"` ONLY at these entries (verify name before editing; line numbers may drift a few lines):

| ~Line | Entity | Edit |
|---|---|---|
| 1464 | Camo Suit | `{ "type": "armor" }` → `{ "type": "armour" }` |
| 3061 | Executive Corpo Suit | same |
| 3747 | Hazard Protection Suit | same |
| 7232 | Polycarbonate Carapace Armour | `{ "type": "armor", "amount": 2 }` → `{ "type": "armour", "amount": 2 }` |
| 7657 | Reactive Armour | `{ "type": "armor", "amount": 1 }` → `{ "type": "armour", "amount": 1 }` |
| 10410 | Wingsuit | `{ "type": "armor" }` → `{ "type": "armour" }` |

Then remove nothing else — `reliable` (Precision Drill, Drill), `deployable` (Heavy Machine Gun), `bio-equipment` (Bio-Rifle), `meld infection` (9 NPC actions) stay as-is, covered by the allowlist until definitions are sourced.

- [ ] **Step 6: Update the test to assert zero unknowns, then verify**

Change the test assertion to:

```typescript
    expect(issues).toEqual([])
```

Run: `bun --filter salvageunion-reference test && bun run build:package && bun run validate:all`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/salvageunion-reference/data/actions.json packages/salvageunion-reference/tools/
git commit -m "fix(data): correct armor->armour trait types, validate trait vocabulary"
```

- [ ] **Step 8 (follow-up, content-gated):** The four allowlisted types (`reliable`, `deployable`, `bio-equipment`, `meld infection`) need trait entries with definition text sourced from the books — check `docs/audit/RECONCILIATION.md` for source text; if absent, leave the allowlist in place and note it as an open data task. Do not invent rules text.

---

## Task 5: Data fidelity — Needle Missile Pod / Missile Pod

**Files:**
- Modify: `packages/salvageunion-reference/data/actions.json` (~lines 6510-6536)
- Reference: `docs/audit/RECONCILIATION.md`

- [ ] **Step 1: Add the missing Uses(30) trait to Needle Missile Pod**

In the Needle Missile Pod entry (id `2f5e34a7-5655-4442-86dd-2d0cd444c36a`, ~line 6510), the traits array is currently:

```json
  "traits": [
    { "type": "guided" },
    { "type": "targeter" }
  ],
```

Text-level edit to:

```json
  "traits": [
    { "type": "guided" },
    { "type": "targeter" },
    { "type": "uses", "amount": 30 }
  ],
```

(Confirmed against the publisher tool bundle per `docs/audit/RECONCILIATION.md` — re-read that doc first; if it contradicts Uses(30), follow the doc and stop.)

- [ ] **Step 2: Restore the dropped rules sentence**

`docs/audit/RECONCILIATION.md` records a dropped final content sentence for Needle Missile Pod (the Offensive Protocols worked example). Read the doc; if it contains the source text, append it as the final string in the entry's second `content` paragraph (text-level edit, matching the existing escaping). If the doc does NOT contain the verbatim text, skip and record an operator step "transcribe Needle Missile Pod final sentence from Workshop Manual" — do not paraphrase from memory.

- [ ] **Step 3: Resolve the sibling Missile Pod Uses(6)**

Search `actions.json` for the WM-4 `Missile Pod` entry (`grep -n '"name": "Missile Pod"' packages/salvageunion-reference/data/actions.json`). Per the same RECONCILIATION.md source, it should carry `{ "type": "uses", "amount": 6 }`. Apply the same pattern as Step 1 if the doc confirms; skip with a note if not.

- [ ] **Step 4: Validate and commit**

Run: `bun run build:package && bun run validate:all && bun --filter salvageunion-reference test`
Expected: PASS.

```bash
git add packages/salvageunion-reference/data/actions.json
git commit -m "fix(data): add missing Uses traits to Needle Missile Pod and Missile Pod"
```

---

## Task 6: Purge print-book page citations from player-facing text

**Files:**
- Modify: `packages/salvageunion-reference/data/roll-tables.json:~3840-3886` (Salvage Cache Table)
- Modify: `packages/salvageunion-reference/data/actions.json`, `data/chassis.json`, `data/guides.json` (inline `p. N` citations)

- [ ] **Step 1: Rewrite the Salvage Cache Table rows**

In `roll-tables.json`, entry id `dd4d6469-fd9d-4eeb-86fc-b8202477d5e3`, replace the 8 citation rows (text-level, value strings only):

| Key | Current | Replacement |
|---|---|---|
| `"20"` | `Random Intact T3 Chassis p.38 - 44 [PC]` | `Random Intact Tech 3 Chassis (Mediator's choice or roll from the Chassis listings)` |
| `"18-19"` | `Random Intact T3 System or Module p.59,60,74 [PC]` | `Random Intact Tech 3 System or Module` |
| `"16-17"` | `Random Intact T2 Chassis p.68- 73 [PC]` | `Random Intact Tech 2 Chassis` |
| `"14-15"` | `Random Intact T2 System p.53 - 58 [PC]` | `Random Intact Tech 2 System` |
| `"12-13"` | `Random Intact T2 Module p.68 - 73 [PC]` | `Random Intact Tech 2 Module` |
| `"8-9"` | `Random Intact T1 Chassis p.10 - 20 [PC]` | `Random Intact Tech 1 Chassis` |
| `"6-7"` | `Random Intact T1 System p.48 - 53 [PC]` | `Random Intact Tech 1 System` |
| `"4-5"` | `Random Intact T1 Module p.64 - 67 [PC]` | `Random Intact Tech 1 Module` |

(The SRD's listing pages already filter by tech level, so prose references suffice; structured `source`/`page` fields on the entry keep provenance.)

- [ ] **Step 2: Sweep remaining inline citations in actions.json and chassis.json**

Find them: `grep -nE 'p\.\s?[0-9]' packages/salvageunion-reference/data/actions.json packages/salvageunion-reference/data/chassis.json`

~13 hits (e.g. `actions.json:725` "A.I. Personality Table p. 91", `chassis.json:693` "p. 106"). Transform rule, applied per instance as a text-level edit: remove the ` p. N` / ` p.N - M` fragment and, where the sentence names a table or section that exists in the SRD (e.g. "A.I. Personality Table"), leave the bare name — the entity-linking layer already resolves named table references. Where the citation IS the content (no surrounding name), rewrite as "see the <thing> listings in this SRD". Keep a list of every edited line for the commit message.

- [ ] **Step 3: Leave guides.json citations but record them**

`guides.json` has 16+ `p. N` references inside long-form guide prose; rewriting those changes authored text and needs editorial judgment. Do not edit in this task — append the grep output to `docs/audit/RECONCILIATION.md` under a new "Inline page citations remaining (guides.json)" heading so the backlog owns it.

- [ ] **Step 4: Validate and commit**

Run: `bun run build:package && bun run validate:all && bun test`
Expected: PASS.

```bash
git add packages/salvageunion-reference/data/ docs/audit/RECONCILIATION.md
git commit -m "fix(data): replace print-book page citations with SRD-native references"
```

---

## Task 7: Harden validate:all

**Files:**
- Modify: `packages/salvageunion-reference/tools/checkUniqueIds.ts:77-99`
- Create: `packages/salvageunion-reference/tools/validateSchemas.ts`
- Modify: `packages/salvageunion-reference/package.json` (scripts)

`checkUniqueIds.ts` hardcodes 21 of 27 data files; `catalog-categories.json` (6 semantic slug ids, documented meta-schema), `distances.json`, `factions.json`, `guides.json`, `sources.json`, `tech-levels.json` are skipped entirely. All 6 skipped files except catalog-categories contain only valid UUIDv4 ids today — the fix is cheap now.

- [ ] **Step 1: Derive the file list instead of hardcoding it**

Replace the `dataFiles` array (lines 77-99) with:

```typescript
import { readdirSync } from 'node:fs'

/** catalog-categories uses documented semantic slug ids (e.g. "pilot") —
 *  exempt from the UUIDv4 format check but still checked for duplicates. */
const SLUG_ID_FILES = new Set(['catalog-categories.json'])

const dataFiles = readdirSync(new URL('../data', import.meta.url))
  .filter((f) => f.endsWith('.json'))
  .sort()
```

Then in `checkId` (line ~70), skip the UUID-format branch when `SLUG_ID_FILES.has(filename)` (thread `filename` in — the enclosing function already has it), keeping duplicate tracking unconditional.

- [ ] **Step 2: Verify the derived list covers all 27 files and passes**

Run: `bun --filter salvageunion-reference validate:ids`
Expected: PASS, output mentioning 27 files (previously 21). If any of the 6 newly-covered files fails, the failure is real — fix the data, don't re-exempt.

- [ ] **Step 3: Add a whole-dataset Zod validation step**

Create `packages/salvageunion-reference/tools/validateSchemas.ts`:

```typescript
/**
 * Parse every data file through its Zod schema by forcing a full preload.
 * Catches shape drift that id/reference checks cannot.
 */
import { SalvageUnionReference } from '../lib/index'

await SalvageUnionReference.preload('all')

const failures: string[] = []
// preload logs-and-skips schemas that fail to load; verify each is queryable.
for (const schema of SalvageUnionReference.getSchemaCatalog().schemas) {
  if (schema.meta) continue
  if (!SalvageUnionReference.isLoaded(schema.id)) failures.push(schema.id)
}

if (failures.length) {
  console.error(`✗ schemas failed to load/validate: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('✓ all schemas parsed and loaded')
```

First verify the API surface: check whether `getSchemaCatalog` is a static on `SalvageUnionReference` or a separate export in `lib/index.ts` (search.ts imports it as a named function — adjust the import to match), and confirm `preload` actually Zod-parses (look at `loadSchemas` in `lib/`); if it doesn't, route through whatever loader does parse, or call `schema.parse(data)` per file using `SCHEMA_DEFINITIONS` from `lib/schemaDefinitions.ts`.

- [ ] **Step 4: Wire into validate:all**

In `packages/salvageunion-reference/package.json` scripts:

```json
    "validate:schemas": "bun tools/validateSchemas.ts",
    "validate:all": "bun run validate:ids && bun run validate:references && bun run validate:actions && bun run validate:orphans && bun run validate:traits && bun run validate:schemas",
```

- [ ] **Step 5: Run, then commit**

Run: `bun run validate:all` (from root)
Expected: PASS including the new step.

```bash
git add packages/salvageunion-reference/tools/ packages/salvageunion-reference/package.json
git commit -m "feat(validate): derive data-file list, add full Zod parse to validate:all"
```

---

## Task 8: Schema tightening pass

**Files:**
- Modify: `packages/salvageunion-reference/lib/schemas/objects.ts` (StatsSchema/ChassisStatsSchema 42-73, SystemModuleSchema 385-395, ActionSchema 636-689)
- Modify: `packages/salvageunion-reference/lib/schemas/entities.ts` (MetaActionSchema 77-84)
- Modify: `packages/salvageunion-reference/lib/schemas/common.ts` (TechLevelSchema 50-52)
- Modify: `apps/in-the-union-now/src/**/mechUtils.ts:36-39`, `builderUtils.ts:65-66`

One PR-sized commit; every sub-change is verified by `build:package` + `validate:all` (the dataset is the test fixture — if the data still parses, the tightening matches reality).

- [ ] **Step 1: Make ActionSchema strict and collapse MetaActionSchema**

In `objects.ts`, add `.strict()` to the object inside ActionSchema's `z.lazy(...)` (lines 636-689) — it is the only non-strict entity schema (686 entries unguarded). Then in `entities.ts:77-84`, `displayName` and `activationCurrency` already exist in ActionSchema's shape, so the `.and()` wrapper adds nothing but breaks strictness semantics. Replace with:

```typescript
export const MetaActionSchema = ActionSchema.describe(
  'Actions, abilities, and attacks that can be performed'
)
```

Caveat from the audit: before pruning any of ActionSchema's individual fields, grep `SURefMetaEntity` accesses in `packages/suref-react/src` — comment-and-keep is acceptable for fields the union types touch. This task only adds `.strict()`; prune nothing.

- [ ] **Step 2: Deduplicate ChassisStatsSchema and require chassis stats**

`ChassisStatsSchema` (objects.ts:60-73) is byte-identical to `StatsSchema` (42-55) except `.describe()`. All 51/51 chassis entries populate all 8 stats. Replace the whole ChassisStatsSchema definition with:

```typescript
export const ChassisStatsSchema = StatsSchema.required({
  structurePoints: true,
  energyPoints: true,
  heatCapacity: true,
  systemSlots: true,
  moduleSlots: true,
  cargoCapacity: true,
  techLevel: true,
  salvageValue: true,
}).describe('Statistics specific to chassis — all stats required')
```

- [ ] **Step 3: Tighten TechLevelSchema and SystemModuleSchema**

`common.ts:50-52`:

```typescript
export const TechLevelSchema = z
  .union([z.number().int().min(1).max(6), z.literal('B'), z.literal('N')])
  .describe("Technology level 1-6, or 'B' for Bio, or 'N' for Nanite")
```

`objects.ts:385-395` (SystemModuleSchema): add an optional `name` so `customSystemOptions` entries validate:

```typescript
export const SystemModuleSchema = StatsSchema.extend({
  name: z.string().min(1).describe('Display name (used by custom system options)').optional(),
  techLevel: TechLevelSchema,
  // ...existing fields unchanged
```

- [ ] **Step 4: Delete confirmed-dead optional fields**

For each of: `CrawlerBaySchema.table`, `BioTitanSchema.systems`, `BioTitanSchema.modules`, `NPCSchema.structurePoints`, and any `npc` field on chassis stats — first confirm zero data usage (`grep -n '"table":' data/crawler-bays.json` etc.) and zero code reads (`grep -rn '\.structurePoints' apps/ packages/suref-react/src` filtered to NPC contexts). Delete only the schema lines whose greps come back empty; list any kept field in the commit body with the hit that saved it.

- [ ] **Step 5: Rebuild, validate, fix downstream**

Run: `bun run build:package && bun run validate:all && bun run typecheck`
Expected: validate PASS (if any data entry fails the new strictness, the entry has a real typo — fix the data, citing this task). Typecheck may now flag ITUN's redundant fallbacks; in `mechUtils.ts:36-39` remove the four `?? 0` (chassis stats are non-optional now) and in `builderUtils.ts:65-66` keep `chassis?.systemSlots ?? 0` only because `chassis` itself is nullable — change to `chassis ? chassis.systemSlots : 0` if lint flags the dead coalesce.

Run: `bun test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/salvageunion-reference/lib apps/in-the-union-now/src
git commit -m "feat(schemas): strict ActionSchema, required chassis stats, tightened tech levels"
```

---

## Task 9: Search fixes — preload race, Enter key, category crowding

**Files:**
- Modify: `apps/suref-web/src/components/islands/SearchIsland.tsx`
- Modify: `packages/salvageunion-reference/lib/search.ts:37-41` (+ export), `lib/index.ts:~463`
- Test: `apps/suref-web/src/components/islands/__tests__/SearchIsland.test.tsx`

Bug: `SearchIsland.tsx:44` calls `useGameData()` discarding `ready`; `search()` builds a module-singleton index from whatever has loaded — searching early permanently caches an empty index.

- [ ] **Step 1: Make the index invalidate on preload (defense in depth)**

In `packages/salvageunion-reference/lib/search.ts`, after the `let searchIndex` declaration (line 37):

```typescript
/** Reset the lazy index — called by preload() so an index built before data
 *  loaded never survives a successful preload. */
export function invalidateSearchIndex(): void {
  searchIndex = null
}
```

In `lib/index.ts`, inside `preload()` next to the existing `invalidateActionMap()` call (~line 463), add `invalidateSearchIndex()` (import it where `invalidateActionMap` is imported). Export `invalidateSearchIndex` from the barrel only if `invalidateActionMap` is exported there too — match the existing pattern.

- [ ] **Step 2: Write failing island tests**

Append to `__tests__/SearchIsland.test.tsx` (conventions per existing file — `bun:test`, Testing Library, 150ms debounce waits; the bunfig preload means data IS loaded in tests, so test the ready-gated behavior via the navigation/cap contract):

```typescript
test('Enter with no arrow selection navigates to the first result', async () => {
  render(<SearchIsland />)
  const input = screen.getByRole('combobox')
  await act(async () => {
    fireEvent.change(input, { target: { value: 'chassis' } })
    await new Promise((r) => setTimeout(r, 200))
  })
  const firstOption = screen.getAllByRole('option')[0] as HTMLAnchorElement
  const assignSpy = spyOn(window.location, 'assign').mockImplementation(() => {})
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(assignSpy).toHaveBeenCalledWith(firstOption.getAttribute('href'))
  assignSpy.mockRestore()
})

test('category rows are capped so entity hits are never crowded out', async () => {
  render(<SearchIsland />)
  const input = screen.getByRole('combobox')
  await act(async () => {
    // 'c' prefix-matches many category displayNames
    fireEvent.change(input, { target: { value: 'c' } })
    await new Promise((r) => setTimeout(r, 200))
  })
  const categoryRows = screen
    .getAllByRole('option')
    .filter((el) => el.textContent?.includes('Category'))
  expect(categoryRows.length).toBeLessThanOrEqual(3)
  expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(10)
})
```

(`spyOn` from `bun:test`; if happy-dom forbids spying on `location.assign`, refactor the component to take an injectable `navigate` defaulting to `(url) => window.location.assign(url)` and assert on that.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun --filter suref-web test SearchIsland`
Expected: FAIL — Enter is a no-op without selection; categories uncapped.

- [ ] **Step 4: Implement in SearchIsland.tsx**

Four edits:

(a) Capture readiness (line 44): `const { ready } = useGameData()`

(b) Gate and re-run `performSearch` — replace the existing callback body's search section and add a ready-flip effect:

```tsx
const performSearch = useCallback(
  (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsOpen(false)
      setHasSearched(false)
      return
    }
    const schemaResults = matchSchemas(searchQuery).slice(0, 3)
    const hits = ready
      ? search({ query: searchQuery, limit: 10 - schemaResults.length })
      : []
    setResults([...schemaResults, ...hits.map(toDisplayResult)])
    setIsOpen(true)
    setHasSearched(true)
    setSelectedIndex(-1)
  },
  [ready]
)

// When data arrives after the user already typed, re-run the pending query.
useEffect(() => {
  if (ready && query.trim() && hasSearched) performSearch(query)
}, [ready]) // eslint-disable-line react-hooks/exhaustive-deps
```

(c) Enter handler — replace the `'Enter' && selectedIndex >= 0` branch (lines 90-95):

```tsx
} else if (e.key === 'Enter') {
  e.preventDefault()
  const target = selectedIndex >= 0 ? results[selectedIndex] : results[0]
  if (target) window.location.assign(target.url)
}
```

(This also removes the fragile `getElementById(...).click()` navigation, resolving the low-priority hygiene finding.)

(d) Loading row — in the dropdown, before the `results.length > 0` ternary, when `!ready` render:

```tsx
{!ready ? (
  <div className="px-4 py-3 text-sm text-su-grey-dark">Loading game data…</div>
) : results.length > 0 ? (
```

(keep the existing `: (` no-results branch as the final arm).

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun --filter suref-web test SearchIsland && bun --filter salvageunion-reference test`
Expected: PASS (all pre-existing aria-live tests too — the loading row only renders pre-ready, and tests preload data).

- [ ] **Step 6: useId hygiene (bundled low-pri finding)**

Replace the hardcoded `search-results` / `search-result-${i}` ids with a `useId()` prefix:

```tsx
const idPrefix = useId()
// listbox id: `${idPrefix}-results`; options: `${idPrefix}-result-${index}`
// aria-controls / aria-activedescendant updated to match
```

Run the island tests once more: PASS expected (tests query by role, not id).

- [ ] **Step 7: Commit**

```bash
git add apps/suref-web/src/components/islands packages/salvageunion-reference/lib
git commit -m "fix(suref-web): gate search on data readiness, Enter navigates first result, cap category rows"
```

---

## Task 10: Schema listing page — skeleton fallback and empty state

**Files:**
- Modify: `apps/suref-web/src/components/islands/SchemaViewerIsland.tsx:86-168`
- Test: `apps/suref-web/src/components/islands/__tests__/SchemaViewerIsland.test.tsx`

- [ ] **Step 1: Write the failing empty-state test**

```typescript
it('shows an empty state with a clear-filters action when filters match nothing', () => {
  const firstSchema = entitySchemas[0]!
  const model = getModel(firstSchema.id)!
  const { getByText, getByRole } = render(
    <SchemaViewerIsland
      initialData={model.all()}
      schemaId={firstSchema.id}
      techLevels={[1, 2, 3]}
      sources={['Core', 'Rig']}
    />
  )
  // activate a source filter that matches nothing by clicking a chip whose
  // source no entity carries — 'Rig' is synthetic in this fixture
  fireEvent.click(getByText('Rig'))
  expect(getByText('No items match the current filters.')).toBeTruthy()
  fireEvent.click(getByRole('button', { name: 'Clear filters' }))
  expect(document.querySelectorAll('a[aria-label]').length).toBeGreaterThan(0)
})
```

Run: `bun --filter suref-web test SchemaViewerIsland` — Expected: FAIL (no empty state exists).

- [ ] **Step 2: Implement skeleton fallback + empty state**

In `SchemaViewerIsland.tsx`: give the `GameDataGate` (line 87) a fallback mirroring the grid (import `ReferenceEntityCardSkeleton` — already imported for Suspense):

```tsx
<GameDataGate
  fallback={
    <div className={containerClass}>
      <div className="w-full min-w-0 flex-1 px-2 pt-2 pb-6 md:p-6 md:pt-2 lg:px-0">
        <div className="columns-1 gap-4 md:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {Array.from({ length: 9 }, (_, i) => (
            <ReferenceEntityCardSkeleton key={i} compact />
          ))}
        </div>
      </div>
    </div>
  }
>
```

And replace the bare `{filteredData.map(...)}` grid contents with:

```tsx
{filteredData.length === 0 ? (
  <div className="flex flex-col items-start gap-3 p-4">
    <p className="text-sm text-su-grey-dark">No items match the current filters.</p>
    <button
      type="button"
      className="btn text-sm"
      onClick={() => {
        setTechLevelFilters(new Set())
        setSourceFilters(new Set())
      }}
    >
      Clear filters
    </button>
  </div>
) : (
  filteredData.map((item: SURefEntity) => {
    /* existing card mapping unchanged */
  })
)}
```

(Reuse the existing `btn` class — check the file's chip/button styling and match it; do not invent new CSS.)

- [ ] **Step 3: Verify and commit**

Run: `bun --filter suref-web test`
Expected: PASS including pre-existing FilterRow tests.

```bash
git add apps/suref-web/src/components/islands
git commit -m "fix(suref-web): skeleton fallback and filter empty state on schema listings"
```

---

## Task 11: Print styles

**Files:**
- Modify: `apps/suref-web/src/styles/global.css`
- Modify: `apps/suref-web/src/layouts/BaseLayout.astro:107-115` (add print classes to chrome wrappers)

- [ ] **Step 1: Add a print block to global.css**

Append:

```css
@media print {
  body,
  main {
    background: #fff !important;
    color: #000 !important;
  }
  /* Page chrome is marked print:hidden in markup; belt-and-braces here for
     elements rendered by islands after hydration. */
  nav,
  footer,
  [data-print-hide] {
    display: none !important;
  }
  main a {
    text-decoration: none;
    color: inherit;
  }
}
```

- [ ] **Step 2: Hide chrome in markup**

In `BaseLayout.astro` body (lines 107-115): add Tailwind `print:hidden` to the `TopNavigation` and `Footer` mounts — these are components, so wrap them: `<div class="print:hidden"><TopNavigation ... /></div>` and same for `<Footer ... />`. Inspect `TopNavigation`'s rendered root first — if it already renders a `<nav>` element the global.css rule covers it and the wrapper div is unnecessary; prefer the no-wrapper variant when the root element is targetable.

- [ ] **Step 3: Listing pages print single-column**

In `SchemaViewerIsland.tsx`, on the masonry grid div (the `columns-1 gap-4 md:columns-2 xl:columns-3` element), append `print:columns-1`. Cards already carry `break-inside-avoid`.

- [ ] **Step 4: Verify**

Run: `bun run build && bunx serve apps/suref-web/dist` is overkill — instead build and inspect: `bun run build`, then `grep -n '@media print' apps/suref-web/dist/_astro/*.css | head -2`
Expected: the print block appears in the built CSS. (Visual confirmation: open a chassis page in the dev server, Cmd+P, check nav/footer absent — note this for the user; screenshot iteration per project CSS rules if it looks wrong.)

- [ ] **Step 5: Commit**

```bash
git add apps/suref-web/src
git commit -m "feat(suref-web): print stylesheet — hide chrome, single-column, light-on-white"
```

---

## Task 12: SEO signal repair — sitemap lastmod, meta descriptions, og:image

**Files:**
- Modify: `apps/suref-web/astro.config.mjs:12-18`
- Modify: `apps/suref-web/src/pages/schema/[schemaId]/item/[itemId].astro:22-29`
- Modify: `apps/suref-web/src/layouts/BaseLayout.astro:62-76`

- [ ] **Step 1: Delete the false-lastmod serialize hook**

In `astro.config.mjs`, reduce the sitemap integration to:

```javascript
    sitemap({
      filter: (page) => !page.includes('/image') && !page.includes('/greembeem'),
    }),
```

(No lastmod beats a lastmod proven false on all 1,582 URLs.)

- [ ] **Step 2: Differentiate boilerplate meta descriptions with stats/traits**

In `[itemId].astro`, replace lines 22-29 with:

```astro
// Build meta description: first content paragraph > stat line > schema fallback
const firstParagraph = staticSummary?.contentParagraphs[0]
const statLine = staticSummary?.stats
  .slice(0, 4)
  .map((s) => `${s.label} ${s.value}`)
  .join(', ')
const traitLine = staticSummary?.traits.length
  ? ` Traits: ${staticSummary.traits.join(', ')}.`
  : ''
const metaDescription = firstParagraph
  ? firstParagraph.length > 155
    ? firstParagraph.slice(0, 152) + '...'
    : firstParagraph
  : statLine
    ? `${itemName} — ${schemaName} for the Salvage Union TTRPG. ${statLine}.${traitLine}`.slice(0, 158)
    : itemDescription ||
      `${itemName}: ${schemaName} reference for the Salvage Union tabletop RPG.`
```

(Caveat from audit: for systems/modules whose damage/range live on a referenced action, `staticSummary.stats` may be sparse — `traitLine` is the differentiator there; ~85 pages with neither stay on the schema fallback, acceptable.)

- [ ] **Step 3: og:image dimensions only for the default image, add alt**

In `BaseLayout.astro`: locate where `ogImageUrl` is computed in the frontmatter (above line 55) and the default OG image constant. Emit dimensions conditionally and add alt:

```astro
<meta property="og:image" content={ogImageUrl} />
{ogImageUrl === DEFAULT_OG_IMAGE && (
  <>
    <meta property="og:image:width" content="790" />
    <meta property="og:image:height" content="352" />
  </>
)}
<meta property="og:image:alt" content={ogImageAlt ?? title} />
```

where `DEFAULT_OG_IMAGE` is the existing default-path constant (find its current name in the frontmatter; introduce the constant if it's an inline string) and `ogImageAlt` is a new optional Prop defaulting to undefined. Entity pages already pass entity art via props — pass `ogImageAlt={itemName}` from `[itemId].astro`.

- [ ] **Step 4: Verify build output**

Run: `bun run build`
Then: `grep -c 'lastmod' apps/suref-web/dist/sitemap-0.xml || true` — Expected: `0`.
And: `grep -o 'og:image:alt' apps/suref-web/dist/schema/chassis/item/*/index.html | head -1` — Expected: a hit.
Spot-check two systems item pages' `<meta name="description"` differ from each other.

- [ ] **Step 5: Commit**

```bash
git add apps/suref-web
git commit -m "fix(suref-web): drop false sitemap lastmod, stat-based meta descriptions, og:image alt"
```

---

## Task 13: Self-host fonts, un-break the CSP

**Files:**
- Modify: `apps/suref-web/package.json` (add @fontsource deps)
- Modify: `apps/suref-web/src/layouts/BaseLayout.astro:80-83`
- Modify: `apps/suref-web/netlify.toml:60-64`
- Modify: `docs/architecture/seo-accessibility.md:33`

The CSP (`netlify.toml:51`) allows only `'self'` for style/font but `BaseLayout.astro:81-83` loads Barlow from Google Fonts — either fonts are blocked in production or the header config is dead; self-hosting fixes both readings and improves LCP.

- [ ] **Step 1: Add fontsource packages**

```bash
cd apps/suref-web && bun add @fontsource/barlow @fontsource/barlow-semi-condensed
```

- [ ] **Step 2: Swap the Google Fonts links for imports**

Delete `BaseLayout.astro` lines 80-83 (the comment + preconnect ×2 + stylesheet link). Add to the top of the frontmatter (or to `src/styles/global.css` if other global imports live there — match where Tailwind is imported):

```astro
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow-semi-condensed/500.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'
```

(Exactly the weights the deleted link loaded.)

- [ ] **Step 3: Clean stale config/docs**

- `netlify.toml:60-64`: the `/fonts/*` cache header targets a directory that doesn't exist (fontsource woff2 ships under `/_astro/` which already has immutable caching at lines 55-58) — delete the `/fonts/*` block.
- `docs/architecture/seo-accessibility.md:33`: update the fonts sentence to say Barlow is self-hosted via @fontsource and covered by the strict `font-src 'self'` CSP.

- [ ] **Step 4: Verify**

Run: `bun run build`
Then: `grep -rn 'fonts.googleapis' apps/suref-web/dist/ | head -3` — Expected: no output.
And: `ls apps/suref-web/dist/_astro/ | grep -i barlow | head -3` — Expected: woff2 files present.

- [ ] **Step 5: Commit**

```bash
git add apps/suref-web docs/architecture/seo-accessibility.md bun.lock
git commit -m "fix(suref-web): self-host Barlow via fontsource, satisfying the strict CSP"
```

---

## Task 14: Generate llms.txt from the schema catalog

**Files:**
- Create: `apps/suref-web/src/pages/llms.txt.ts`
- Delete: `apps/suref-web/public/llms.txt`

The static file lists 21 schema IDs; `getSchemaCatalog()` serves 24 (missing: `guides`, `tech-levels`, `crawler-tech-levels`) plus meta schemas. Generating it ends the drift.

- [ ] **Step 1: Write the route**

Create `apps/suref-web/src/pages/llms.txt.ts`:

```typescript
import type { APIRoute } from 'astro'
import { getSchemaCatalog } from 'salvageunion-reference'

export const GET: APIRoute = () => {
  const { schemas } = getSchemaCatalog()
  const entitySchemas = schemas.filter((s) => !s.meta)

  const categories = entitySchemas
    .map((s) => `- ${s.displayNamePlural} (${s.description}): https://salvageunion.io/schema/${s.id}/`)
    .join('\n')

  const ids = entitySchemas.map((s) => `- \`${s.id}\` — ${s.description}`).join('\n')

  const body = `# Salvage Union System Reference Document (SRD)

> An open-source, searchable reference for the Salvage Union tabletop RPG by Leyline Press.

salvageunion.io is a community-built System Reference Document (SRD) for Salvage Union, a post-apocalyptic mech TTRPG.

## Content Categories

${categories}

## Licensing

Game text and mechanics are published under the Salvage Union Open Game Licence (OGL 1.0b): https://leyline.press/pages/salvage-union-open-game-licence-1-0b
Artwork (asset_url fields) is NOT covered by the licence — used with special permission of Leyline Press; do not redistribute.
Republication of licensed text must include the legal notices required by OGL 1.0b.
Salvage Union is created and published by Leyline Press (https://leyline.press).

## JSON API

CORS is enabled for all endpoints (Access-Control-Allow-Origin: *).

Base URL: https://salvageunion.io

- GET /schema/{schemaId}.json — full data array for a schema
- GET /schema/{schemaId}.schema.json — JSON Schema definition
- GET /schema/{schemaId}/item/{itemId}.json — individual entity by slug

### Available Schema IDs

${ids}

Full API documentation: https://salvageunion.io/api/

## Other Pages

- About: https://salvageunion.io/about/
- Sitemap: https://salvageunion.io/sitemap-index.xml
`

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
```

First verify the catalog import path and field names (`displayNamePlural`, `description`, `meta`) against `getSchemaCatalog`'s return type in the package — `api.astro` line 6-7 uses the same call; mirror it exactly. Check `getSchemaCatalog` data is available at build time without preload in Astro frontmatter context (api.astro proves the pattern — if api.astro preloads first, do the same here).

- [ ] **Step 2: Delete the static file, build, verify**

```bash
git rm apps/suref-web/public/llms.txt
bun run build
```

Then: `grep -c 'schema/' apps/suref-web/dist/llms.txt` — Expected: ≥ 24 schema lines, including `guides` and `tech-levels`.

Decide meta-schema exposure: the 3 meta schemas are served at `/schema/{id}.json` with CORS but documented nowhere — check `apps/suref-web/src/pages/schema/[schemaId].json.ts` (or equivalent) `getStaticPaths`: if meta schemas get JSON routes, document them in the route above under a "Meta schemas" subsection; if they shouldn't be public, filter them out of `getStaticPaths` instead. Make both surfaces agree, either direction.

- [ ] **Step 3: Commit**

```bash
git add apps/suref-web
git commit -m "feat(suref-web): generate llms.txt from schema catalog, ending ID drift"
```

---

## Task 15: Crawler-visible internal links on item pages

**Files:**
- Modify: `apps/suref-web/src/components/StaticEntityContent.astro:39-43`
- Create: `apps/suref-web/src/lib/staticLinks.ts`
- Test: `apps/suref-web/src/lib/__tests__/staticLinks.test.ts`

All 1,554 item pages currently contain zero crawler-visible links to related entities — traits render as plain text and related links only exist post-hydration.

- [ ] **Step 1: Write the failing resolver test**

`apps/suref-web/src/lib/__tests__/staticLinks.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test'
import { resolveTraitHref } from '../staticLinks'

describe('resolveTraitHref', () => {
  test('maps a trait name to its trait item URL', () => {
    expect(resolveTraitHref('armour')).toBe('/schema/traits/item/armour/')
  })
  test('falls back to keywords for keyword-only types', () => {
    expect(resolveTraitHref('irradiated')).toBe('/schema/keywords/item/irradiated/')
  })
  test('returns null for unknown types', () => {
    expect(resolveTraitHref('definitely-not-a-trait')).toBeNull()
  })
})
```

Run: `bun --filter suref-web test staticLinks` — Expected: FAIL (module missing).

- [ ] **Step 2: Implement the resolver**

`apps/suref-web/src/lib/staticLinks.ts`:

```typescript
/**
 * Build-time resolution of trait/keyword names to SRD item URLs.
 * Used by the static (no-JS / crawler) entity fallback, where data is fully
 * loaded during the Astro build.
 */
import { SalvageUnionReference, getEntitySlug } from 'salvageunion-reference'

export function resolveTraitHref(traitType: string): string | null {
  const trait = SalvageUnionReference.Traits.all().find(
    (t) => t.name.toLowerCase() === traitType.toLowerCase()
  )
  if (trait) return `/schema/traits/item/${getEntitySlug(trait)}/`

  const keyword = SalvageUnionReference.Keywords.all().find(
    (k) => k.name.toLowerCase() === traitType.toLowerCase()
  )
  if (keyword) return `/schema/keywords/item/${getEntitySlug(keyword)}/`

  return null
}
```

Verify the model accessor names (`SalvageUnionReference.Traits` / `.Keywords`) against `lib/index.ts`'s ModelFactory registrations and the test-preload pattern; suref-web's bunfig preloads all schemas so the test environment has data.

- [ ] **Step 3: Run tests — PASS expected**

Run: `bun --filter suref-web test staticLinks`

- [ ] **Step 4: Render traits as anchors in the static fallback**

In `StaticEntityContent.astro`, import the resolver in frontmatter and replace lines 39-43:

```astro
{summary.traits.length > 0 && (
  <p class="mb-3">
    <span class="font-mono font-bold uppercase">Traits:</span>{' '}
    {summary.traits.map((t, i) => {
      const href = resolveTraitHref(t)
      return (
        <>
          {i > 0 && ', '}
          {href ? <a href={href} class="underline">{t}</a> : t}
        </>
      )
    })}
  </p>
)}
```

- [ ] **Step 5: Build-time verification**

Run: `bun run build`
Then: `grep -o 'href="/schema/traits/item/[a-z-]*/"' apps/suref-web/dist/schema/equipment/item/*/index.html | sort -u | head -5`
Expected: trait links present in static HTML.

- [ ] **Step 6: Commit**

```bash
git add apps/suref-web/src
git commit -m "feat(suref-web): crawler-visible trait/keyword links in static entity fallback"
```

(Related-entity lists — chassis patterns, class ability trees — are a larger follow-on; the audit's full recommendation continues there, but trait links unblock the link-equity dead end. If time permits, extend `[itemId].astro` with a build-time "Related" `<ul>` using `resolveGrantedEntities(item)` from the package, same anchor pattern.)

---

## Task 16: Stop shipping 1.5 MB of game data on every page

**Files:**
- Modify: `apps/suref-web/astro.config.mjs:51-68`
- Modify: `apps/suref-web/src/lib/useGameData.ts`
- Modify: `apps/suref-web/src/components/islands/SearchIsland.tsx`

Three ordered steps; measure after each. The `manualChunks` rule collapsing the ORM + all 27 JSON files into one `game-data` chunk is the prerequisite — splitting work is invisible until it's gone.

- [ ] **Step 1: Baseline measurement**

```bash
bun run build
du -sk apps/suref-web/dist/_astro/ && ls -S apps/suref-web/dist/_astro/*.js | head -3 | xargs ls -lh
```

Record the game-data chunk size (~1.49 MB raw expected).

- [ ] **Step 2: Remove the game-data manualChunks rule**

In `astro.config.mjs` `manualChunks`, delete only:

```javascript
            if (id.includes('salvageunion-reference')) {
              return 'game-data'
            }
```

Keep the react-vendor rule. Rebuild and re-measure (same commands). Expected: the monolith splits into per-schema JSON chunks; total may be similar but per-page JS drops. Record numbers. Note the caching trade-off in the commit body (one cached monolith vs many small chunks).

- [ ] **Step 3: Defer the search preload to first intent**

`SearchIsland` mounts in the nav on EVERY page and `useGameData()` eagerly preloads everything. Make eagerness opt-in. In `useGameData.ts`:

```typescript
export function useGameData(options?: { defer?: boolean }): {
  ready: boolean
  load: () => void
} {
  const [ready, setReady] = useState(SalvageUnionReference.isLoaded('chassis'))
  const [wanted, setWanted] = useState(!options?.defer)

  useEffect(() => {
    if (ready || !wanted) return
    let cancelled = false
    ensurePreloaded().then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [ready, wanted])

  return { ready, load: () => setWanted(true) }
}
```

In `SearchIsland.tsx`: `const { ready, load } = useGameData({ defer: true })`, and call `load()` in the input's `onFocus` (alongside the existing handler) and in `handleInput`. The Task 9 "Loading game data…" row covers the gap between focus and ready. `GameDataGate` keeps the eager default — entity/listing pages need data immediately.

Run: `bun --filter suref-web test` — Expected: PASS (tests preload data globally, `isLoaded` short-circuits to ready).

- [ ] **Step 4: Verify deferral in the built site**

`bun run build`, then check the landing page HTML pulls no schema-data chunks: `grep -c 'game-data\|actions.*\.js' apps/suref-web/dist/index.html || true` and compare total `<script`/modulepreload bytes on `dist/index.html` vs baseline. Expected: landing page JS payload drops by roughly the old chunk size; record before/after in the commit message.

- [ ] **Step 5: Commit**

```bash
git add apps/suref-web
git commit -m "perf(suref-web): split game-data chunk, defer search preload to first intent"
```

(Subset preloads — `preload(['chassis', ...])` per island with transitive cross-schema refs — are the third stage; land the first two and measure before deciding it's still worth the reference-closure analysis. If pursued: `GameDataGate` takes an optional `schemas?: string[]` prop, `ensurePreloaded` keys promises per schema-set, and every island passes its own schema + `['actions', 'traits', 'keywords']`.)

---

## Task 17: PWA — make the installable claim true

**Files:**
- Modify: `apps/suref-web/public/site.webmanifest`
- Modify: `apps/suref-web/astro.config.mjs`, `apps/suref-web/package.json`

`site.webmanifest` declares `display: standalone` (installable) with no service worker — the installed app is 100% broken offline. Do this AFTER Task 16 (precache must not include a 1.5 MB monolith).

- [ ] **Step 1: Fix the manifest minimum**

In `public/site.webmanifest`: add `"start_url": "/",` after `"short_name"`, and remove the trailing comma after the second icon object if present (validate with `bunx jsonlint apps/suref-web/public/site.webmanifest` or `bun -e 'JSON.parse(await Bun.file("apps/suref-web/public/site.webmanifest").text())'`).

- [ ] **Step 2: Add @vite-pwa/astro**

```bash
cd apps/suref-web && bun add -d @vite-pwa/astro
```

In `astro.config.mjs`:

```javascript
import AstroPWA from '@vite-pwa/astro'
// in integrations, after sitemap(...):
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: false, // keep the hand-authored public/site.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,woff2,svg}'],
        navigateFallback: null, // static site — let pages 404 naturally offline
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'pages' },
          },
          {
            urlPattern: /\/schema\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'data' },
          },
        ],
      },
    }),
```

Check @vite-pwa/astro's current option names against its README before committing (the `manifest: false` and `navigateFallback` spellings move between majors). Do NOT precache images or HTML (1,586 pages); stale-while-revalidate fills the cache as the player browses — which matches table use (you visit your mech's pages before the session).

- [ ] **Step 3: Verify**

`bun run build`, then: `ls apps/suref-web/dist/sw.js` — Expected: service worker emitted. `grep -c 'globPatterns\|precache' apps/suref-web/dist/sw.js` returns ≥1. Check the precache manifest size inside `sw.js` is sane (< 2 MB total references).

- [ ] **Step 4: Commit**

```bash
git add apps/suref-web bun.lock
git commit -m "feat(suref-web): service worker via @vite-pwa/astro — offline support for table use"
```

---

## Task 18: Error boundary + fallback-stripping order

**Files:**
- Create: `apps/suref-web/src/components/islands/IslandErrorBoundary.tsx`
- Modify: `apps/suref-web/src/lib/useGameData.ts`
- Modify: `apps/suref-web/src/layouts/BaseLayout.astro:96-105`
- Modify: `apps/suref-web/src/components/islands/ReferenceEntityIsland.tsx`

`BaseLayout` strips the server-rendered content (including the only `<h1>`) on load, BEFORE hydration/data; any island render error or preload rejection leaves a permanently blank page.

- [ ] **Step 1: Error boundary component**

```tsx
import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class IslandErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto w-full max-w-6xl p-4 text-sm">
          <p className="mb-2 font-bold">Something went wrong rendering this entry.</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: Handle preload rejection in useGameData**

Extend the hook (composes with Task 16's version): add `error` state set in a `.catch()` on `ensurePreloaded()`, reset `preloadPromise = null` on failure so a retry can work, and return `{ ready, error, load }`. In `GameDataGate`, when `error` render the fallback plus a visually-hidden-from-tests-safe retry: a `<button onClick={load}>Retry loading game data</button>` (where `load` clears error and re-requests).

- [ ] **Step 3: Move fallback stripping to post-hydration**

Delete the `<script>` block in `BaseLayout.astro` (lines 96-105 incl. comment). In `ReferenceEntityIsland.tsx` add inside the component (it has access to `useGameData` — call it; `GameDataGate` below dedupes via the shared promise):

```tsx
const { ready } = useGameData()
useEffect(() => {
  if (!ready) return
  document.querySelectorAll('[data-static-fallback]').forEach((el) => el.remove())
}, [ready])
```

View-transition note: with `ClientRouter`, each navigation swaps in fresh HTML containing the fallback and remounts the island, so the effect re-runs — same coverage as the old `astro:page-load` listener, but only after the island can actually replace the content. Verify there is no double-`<h1>` flash: the fallback `<h1>` now coexists with the hydrating island briefly; if the island also renders an `<h1>` pre-data, hide the fallback visually at hydration instead of removing (`el.setAttribute('hidden', '')` immediately, remove on ready).

- [ ] **Step 4: Wrap the island roots**

In `ReferenceEntityIsland.tsx` (and `SchemaViewerIsland.tsx`), wrap the returned JSX in `<IslandErrorBoundary>…</IslandErrorBoundary>`.

- [ ] **Step 5: Verify**

Run: `bun --filter suref-web test` — Expected: PASS.
Manual: dev server, DevTools offline mode, hard-load an item page — expect the static fallback to REMAIN (not a blank page), since preload rejects.

- [ ] **Step 6: Commit**

```bash
git add apps/suref-web/src
git commit -m "fix(suref-web): error boundaries + strip static fallback only after data is ready"
```

---

## Task 19: DX — typecheck-vs-stale-dist trap, hook docs, lefthook, bun pins

**Files:**
- Modify: `apps/suref-web/tsconfig.json`, `packages/suref-react/tsconfig.json`, `apps/in-the-union-now/tsconfig.json`, root `tsconfig.json`
- Modify: `CLAUDE.md` (hooks + check:all sections)
- Modify: `lefthook.yml`
- Modify: `.github/workflows/ci.yml:10`, `netlify.toml:8`

- [ ] **Step 1: customConditions — typecheck against source, not stale dist**

Vite already resolves `conditions: ['development']` → `lib/index.ts`; align tsc. In `apps/suref-web/tsconfig.json`, `packages/suref-react/tsconfig.json`, and `apps/in-the-union-now/tsconfig.json` compilerOptions add:

```json
    "customConditions": ["development"],
```

(Valid with `moduleResolution: "bundler"`, which all three use.) Then prove the trap is closed: add a junk type error in `packages/salvageunion-reference/lib/helpers.ts` (e.g. change a return type), run `bun run typecheck` WITHOUT rebuilding — Expected: FAIL from the app packages. Revert the junk edit.

- [ ] **Step 2: Drop vestigial composite from root tsconfig**

Root `tsconfig.json` line 40 has `"composite": true` with no `references` anywhere. Delete that line (keep `incremental`). Run `bun run typecheck` — Expected: PASS.

- [ ] **Step 3: Fix CLAUDE.md hook documentation**

Replace the Pre-commit Hooks section body with the truth from `lefthook.yml`:

```markdown
Pre-commit runs: lint --fix, format (parallel). Typecheck does NOT run pre-commit.
Pre-push runs: typecheck, test, validate:all, knip (parallel).
```

Also append `knip` to the `check:all` description in the Quick Reference if missing.

- [ ] **Step 4: Staged-files Prettier in lefthook**

In `lefthook.yml` pre-commit `format` command, switch to staged files:

```yaml
    format:
      glob: '*.{ts,tsx,js,jsx,json,md,astro,css}'
      run: bunx prettier --write {staged_files}
      stage_fixed: true
```

(Leave the ESLint job repo-scoped — ESLint v9 flat configs are per-package; per-workspace `root:` scoping is a separate, optional refinement.) Test: touch one file, `git add` it, commit — pre-commit should finish in seconds and not rewrite unrelated files.

- [ ] **Step 5: Single source of truth for the Bun version**

- `.github/workflows/ci.yml`: delete the `BUN_VERSION: "1.3.9"` env (line 10); update `.github/actions/setup-bun` (the custom action) to pass `bun-version-file: .bun-version` to its underlying `oven-sh/setup-bun` step — read the action's `action.yml` and edit accordingly.
- `netlify.toml:8`: set `BUN_VERSION = "1.3.10"` to match `.bun-version` and add a comment `# keep in sync with .bun-version` (Netlify cannot read the file natively).

- [ ] **Step 6: Type the explicit `any` in catalogHelpers**

In `apps/suref-web/src/lib/catalogHelpers.ts` (or its actual location — `grep -rn 'any' apps/suref-web/src/lib/catalogHelpers.ts` lines ~49-61): replace the `any` annotations with `SURefEnumSchemaName` (for schema-id params) and `SURefEntity` (for entity params) imported from `salvageunion-reference` — NOT `SURefSchemaName`, which does not exist. One localized `as` cast at ~line 74 is acceptable, following the precedent in `apps/suref-web/src/lib/staticPaths.ts`. Run `bun run lint && bun run typecheck` — Expected: PASS with no `no-explicit-any` suppressions.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json apps/*/tsconfig.json packages/suref-react/tsconfig.json CLAUDE.md lefthook.yml .github netlify.toml apps/suref-web/netlify.toml apps/suref-web/src/lib/catalogHelpers.ts
git commit -m "chore(dx): source-resolving typecheck, truthful hook docs, staged prettier, unified bun pin"
```

(Note: `netlify.toml` lives at `apps/suref-web/netlify.toml`; the root-path mention above is defensive — `git add` whichever exists.)

---

## Task 20: Provenance fields, name filter, ITUN follow-through

**Files:**
- Modify: `packages/salvageunion-reference/lib/schemas/entities.ts:405-409`
- Modify: `packages/salvageunion-reference/data/sources.json`
- Modify: `apps/suref-web/src/pages/about.astro`
- Modify: `apps/suref-web/src/components/islands/SchemaViewerIsland.tsx`

- [ ] **Step 1: Add provenance fields to SourceEntitySchema**

```typescript
export const SourceEntitySchema = BaseEntitySchema.extend({
  purchaseLink: z.string().url().describe('URL where this source can be purchased').optional(),
  version: z
    .string()
    .describe('Printing/edition of the source this dataset reflects (e.g. "1.5")')
    .optional(),
  verifiedAgainst: z
    .string()
    .describe('ISO date the dataset was last verified against this printing')
    .optional(),
})
  .strict()
  .describe('Source books and expansions')
```

Rebuild: `bun run build:package`.

- [ ] **Step 2: Populate for the Workshop Manual**

In `data/sources.json`, find the Workshop Manual entry and add (text-level, matching surrounding indentation):

```json
    "version": "1.5",
    "verifiedAgainst": "2026-06-09",
```

ONLY if the 1.5 printing claim can be confirmed from the entry's own `purchaseLink` page or `docs/audit/RECONCILIATION.md`; otherwise add `verifiedAgainst` alone.

- [ ] **Step 3: Surface on /about**

In `about.astro`, in the section describing data sources, render version/verifiedAgainst when present (read via `SalvageUnionReference.Sources.all()` in frontmatter — build-time, no island needed):

```astro
<ul>
  {sources.map((s) => (
    <li>
      {s.name}
      {s.version && ` — printing ${s.version}`}
      {s.verifiedAgainst && ` (verified ${s.verifiedAgainst})`}
    </li>
  ))}
</ul>
```

Match the page's existing list/typography components rather than bare `<ul>` if it has them.

- [ ] **Step 4: Name filter on listing pages**

In `SchemaViewerIsland.tsx`: add `const [nameFilter, setNameFilter] = useState('')`; include in the existing `filteredData` memo chain: `.filter((e) => !nameFilter || e.name.toLowerCase().includes(nameFilter.toLowerCase()))`; render at the top of the filter `aside` (before the Tech Level row), matching FilterRow styling:

```tsx
<FilterRow label="Name">
  <input
    type="search"
    value={nameFilter}
    onChange={(e) => setNameFilter(e.target.value)}
    placeholder="Filter by name…"
    aria-label="Filter items by name"
    className="w-full rounded border border-su-black bg-su-white px-2 py-1 font-mono text-[13px]"
  />
</FilterRow>
```

Wire the Task 10 "Clear filters" button to also `setNameFilter('')`. Note the `aside` only renders when `hasFilters` — ensure the name input renders regardless (move it outside the `hasFilters` conditional or include name in `hasFilters`).

Add a test mirroring Task 10's pattern: type `zzz` into the name input → empty state appears; clear → cards return.

- [ ] **Step 5: Verify, commit, and record the operator step**

Run: `bun run build:package && bun run validate:all && bun test && bun run typecheck`
Expected: PASS.

```bash
git add -A
git commit -m "feat: source provenance fields, about-page surfacing, name filter on listings"
```

OPERATOR: email Leyline Press to confirm Mech Monday / Starter Set licence coverage; record the outcome in `packages/salvageunion-reference/README.md`.

---

## Task 21: Final verification gate

- [ ] **Step 1: Full CI suite**

Run: `bun run check:all` (lint, format, typecheck, test, validate — and confirm whether knip is included per the Task 19 doc fix; run `bun run knip` separately if not).
Expected: PASS on every package. Fix anything that fails before proceeding — superpowers:verification-before-completion applies.

- [ ] **Step 2: Build both artifacts**

Run: `bun run build && bun run build:itun`
Expected: clean builds. Re-record the per-page JS numbers from Task 16 in the PR description.

- [ ] **Step 3: A11y regression scan**

Run the `/a11y-scan` skill against the dev server (search loading row, empty states, error boundary, and print classes all touched rendered output).
Expected: no new WCAG 2.1 AA violations vs main.

- [ ] **Step 4: Summarize**

Write the PR body: group commits by the audit's three clusters (player-facing breakage, legal exposure, silent drift), include before/after bundle numbers, list the operator-gated leftovers (npm deprecate, 1.0b text if unfetched, missing-trait definitions, Leyline Press email, Needle Missile Pod sentence if unsourced).

---

## Execution Order & Dependencies

```
Task 1 (deprecate npm)  ──→ Task 3 (dead code: unlocks helper deletion)
Task 2 (licensing)          independent
Task 4,5,6 (data fixes)     independent of each other; before Task 7
Task 7 (validate hardening) after 4-6 (new checks must pass on fixed data)
Task 8 (schema tightening)  after 7 (validate:schemas guards the change)
Task 9 (search)             independent
Task 10,11 (UX)             independent
Task 12,13,14,15 (SEO)      independent; 14 depends on Task 2's licence wording
Task 16 (bundle)            after 9 (touches same files: SearchIsland, useGameData)
Task 17 (PWA)               after 16 (precache size)
Task 18 (error boundary)    after 16 (useGameData signature)
Task 19 (DX)                independent
Task 20 (provenance/filter) after 8 (schema edits), after 10 (clear-filters button)
Task 21 (verification)      last
```

## Known Risks

- **Schema strictness (Task 8)** may surface latent data typos as validate failures — that's the point; budget time to fix data, not to loosen schemas.
- **Bundle splitting (Task 16)** changes chunk caching behavior; if real-user metrics matter, note the trade-off in the PR rather than optimizing blind.
- **Fallback-stripping reorder (Task 18)** risks a brief duplicate-`<h1>` flash; the hidden-then-remove variant in the task handles it — verify visually before commit.
- **Line numbers in data files** drift as earlier tasks edit the same files — always confirm the entity name/id before each text-level edit.
