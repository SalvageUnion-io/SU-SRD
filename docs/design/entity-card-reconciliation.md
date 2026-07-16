# Entity Card Reconciliation — Canonical Reference

The single source of truth for the entity-card refresh: the **methodology**, the
**current state**, and the **staged cutover plan** (consumers, parity gaps, delete
set, shared files). Supersedes the earlier `component-refresh-methodology.md` and
`entity-card-write-layer-plan.md`.

---

## Part 1 — The methodology (reusable for any component refresh)

A three-level loop, each level a gate before the next.

### L1 — Mockup (design), grounded in a REAL "before"

Design the target as an artifact, but the **"before" is the actual current
component rendered from real code — never a hand-authored caricature** (that hides
the real wrapping / overflow / tone / empty-state bugs).

- Render the real before via **SSR**: `react-dom/server` `renderToStaticMarkup` +
  compiled Tailwind (`@tailwindcss/node` + `@tailwindcss/oxide` Scanner over the
  rendered markup; embed theme fonts as data-URIs). Puppeteer is sandbox-blocked —
  capture HTML+CSS, not screenshots.
- Sample **real ORM data** (`SalvageUnionReference.*`), covering weird cases.
- Nail read-only first; it informs everything.

### L2 — NEW\* Ladle comparison (build alongside, don't replace)

Build the target as **`NEW`-prefixed components** (no collision with legacy) shown
as **three-way Ladle stories on one page — old SRD · new read-only · new editable**,
driven by real SRD data through the real components. Iterate here; the NEW\*
components stay **Ladle-only** (not barrel-exported, no consumers) so iteration is
zero-risk. The write layer is added as **evolutions on the read-only card, never a
redesign**.

### L3 — Reconciliation / cutover (explicit command only)

See Part 3 — the ordered, green-at-every-checkpoint stages.

### Invariants (all levels)

- **Read-only byte-identical:** every write-layer / migration change is additive
  and prop-gated; a card with no write props renders exactly as before — prove it
  by diffing rendered `innerHTML` against `HEAD`.
- **Green at every checkpoint:** typecheck (all packages) + lint + tests +
  `validate:all`, committed per stage.
- **Real data everywhere** (mockups, stories, SSR captures).
- **Data-driven, few special cases:** prefer changing the _data shape_ (e.g. an
  inline `choice` content-block marker) over special-casing the renderer.

---

## Part 2 — Where we are now

- **L1 + L2 complete.** The `NEW*` card system (`packages/suref-react/src/components/referenceEntity/NEW/`)
  is built with the full read-only design + the write layer, and iterated in the
  `NEW/*` Ladle stories.
- **Committed & pushed to PR #466** (branch `worktree-entity-card-capture`): read-only
  `37cd4766`, write layer + choices + modified-stats + stat atoms `25f7c602`.
- The card has: status cycle + damaged greying/dim, selection + controls, editable
  stats, slot overrides, `hide`, `lightweight`, damage overlay; choices render in
  the body (read-only static / editable choosable) via a data-driven interleave
  walk (a `choice` content-block marker positions them); the self-action fold
  bubbles content/stats/traits; `datavalues` bubble to the sub-header; a
  `resolveChoiceView`-driven **"modified stats"** language gives choice-touched
  stats/traits a rust cell border.
- **Stage a LANDED** (`6a552f3b`, pushed to #466): the compat shim + barrel flip
  are live — **every direct `ReferenceEntityDisplay` consumer now renders through
  `NEWReferenceEntityCard`**. The 6 flip-surfaced deltas are all closed (see below).
  Green: typecheck (4 pkgs) + lint + knip + validate:all; tests all pass
  (suref-react 414, suref-web 989, ITUN 1321).
- **Legacy render core is now reachable only through 3 internal suref-react
  consumers** (the shim itself forwards to the new card, not legacy):
  `ClassAbilityTreeDisplay` (imports `ReferenceEntityDisplay/index`),
  `useDetailModal` (renders `ReferenceEntityDisplayContent` in its modal — the
  hidden consumer), and `GuideEntityListing` (renders `ReferenceEntityDisplayContent`).
  These three must be re-pointed to the new card before legacy can be deleted
  (Stage d gate). Each renders in a context (class-ability tree, detail modal,
  guide listing) that wants **screenshot verification** before locking in.
- **L3 in progress — Stage a done; b/c/d remain.**

---

## Part 3 — The cutover plan (L3)

### Stage 0 — close the NEW-card parity gaps (prerequisite)

Inventory every legacy prop a consumer uses; add the missing ones (additive,
read-only stays identical). The gaps (widest first = critical path):

| Gap                                                            | Consumers                                                      | Status                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| **`footActions` + `footMeta`** (footer buttons + cost/SV meta) | dashboard, every sheet, wizard SelCard                         | **DONE** (folded into `NEWIdentityFooter`) |
| `cardStyle: {className, style}` (NEW has only `className`)     | MechItemCard, CrawlerSheet, PilotSheetItems                    | pending                                    |
| `expand` slot (accent field, before footer)                    | CrawlerSheetItems (bay crew)                                   | pending                                    |
| `scalingParent` → choice-cap resolver in `NEWChoiceGroups`     | PilotSheet(Items) (per-Tech-Level caps)                        | pending                                    |
| `titleAs: 'span'\|'h1'` on `NEWCardHeader` (SEO)               | suref-web islands, OG, `[itemId].astro`                        | pending                                    |
| `statsOverride` `{value,bottomLabel}` → `StatItem[]` adapter   | `useChassisPatternConfig` (or switch to native `pattern` prop) | pending                                    |
| NPC parity (`npcConfig` reserved/no-op)                        | encounter/sheet NPC insets                                     | decide: implement or confirm native path   |
| `mode`/`compact`/`listing` → `size`                            | ~everywhere                                                    | handled by the Stage-a shim                |

Also not-yet-implemented on the card (confirm no app dependence, else close):
`hide.rollTable` + roll-table body (no RollTable render), GuideSteps `interactive`
(keep `GuideStepsDisplay` alive), Buy control / external-link footer.

### Stage a — rename NEW→canonical + barrel + compat shim

- Drop the `NEW` prefix across `NEW/` (`NEWReferenceEntityCard`→canonical,
  `NEWCardHeader`/`NEWSubHeader`/`NEWIdentityFooter`/`NEWChoiceGroups`/`newCardTone`).
- Add a thin **compat shim** exported (barrel) under the legacy name
  `ReferenceEntityDisplay` that maps `compact`/`listing`/`mode` → `size` (+ the
  `statsOverride` shape) and forwards to the canonical card. Now every consumer
  renders through the new card at once, no call-site rewrites yet.
- Flip the barrel (`packages/suref-react/src/index.ts:19`).
- Risk: low (additive; legacy still present).

**PROVEN (this session, then reverted to keep the tree green):** the compat shim was
built and the barrel flipped — result: **typecheck clean across all 4 packages**, and
**suref-react (414) + salvageunion-reference (876) + suref-web tests all pass** through
the shim. So the shim + flip are correct; the exact shim is saved at
`~/.claude/jobs/.../tmp/referenceEntityDisplayShim.tsx` (60 lines: maps
`mode`/`compact`/`listing`→`size` via `resolveDisplayMode`, folds `status`
damaged/destroyed→`damaged`, adapts the old single-SV `statsOverride {value,bottomLabel}`
→ `StatItem[]`, spreads the rest 1:1). It was reverted only because a **dormant** shim
trips knip (unused export) — so it must land together with the barrel flip, once the
6 Stage-c deltas below are closed. To re-land: restore the shim file, re-export
`NEWReferenceEntityCardProps`, flip barrel `index.ts` `ReferenceEntityDisplay` → the shim.

**6 reconciliation deltas the flip surfaced — ALL CLOSED (`6a552f3b`):**

1. **Crew NPC choices double-rendered.** `CrawlerCrewStep` hides the card's choices
   (`hide={{ choices: true }}`) and renders the NPC's crew facts (Name/Background/
   Keepsake/Motto) as its own click-to-edit `IdentityFields`. But the card's nested
   NPC **anchor** card didn't inherit the parent's `hide`, so it re-surfaced the same
   "Keepsake"/"Motto" choices — colliding with the IdentityField buttons (a collision
   the always-`button` option markup, delta 3, made visible via `getByRole`).
   **Fix:** the nested NPC anchor card now inherits `hide={hide}`
   (`NEWReferenceEntityCard.tsx`, anchor render). No `npcConfig` needed.
2. **Modification cap counter.** **Fix:** `renderChoiceRegion` passes
   `parent={scalingParent}` directly (was `scalingParent ?? entity`, which fell back
   to the equipment's own `techLevel` and produced a spurious cap). Absent scaling
   source ⇒ `resolveMultiSelectCap` returns undefined ⇒ no `n/max` counter.
3. **Choice-card readOnly / aria-pressed markup.** **Fix:** `NEWChoiceOption` always
   renders a `button[aria-pressed]` (queryable in both modes for the read-only
   snapshot / share-link viewer); read-only just makes it inert (no toggle handler,
   default cursor). Persistence stays gated by `onSelectionChange` (undefined in
   read-only ⇒ a click can't reach the store).

### Stage b — migrate suref-web islands

`ReferenceEntityIsland`, `SchemaViewerIsland`, `OgCardIsland`,
`item/[itemId].astro`, `og-screenshots.ts`. Needs `titleAs`, `label` semantics,
`afterExtraContent` (ClassAbilityTreeDisplay); `getClassSelections` stays. Verify
OG screenshots + a11y. Risk: medium (SEO H1 + OG pixel compare).

### Stage c — migrate ITUN surface-by-surface (lowest-risk first)

1. **Dashboard** — `DisplayView`, `SrdExplorer` (needs `footActions`).
2. **Wizard** — swap the inner RED in `wizard/SelCard.tsx` (keep the external `Sel`
   halo) → migrates every SelCard consumer at once; then direct-RED steps/reviews
   (`ClassStep`, `ReviewStep`, `ChassisStep`, `MechReviewStep`, `CrawlerTypeStep`,
   `CrawlerReviewStep`, `CrawlerCrewStep`, `InstallCard`, `LoadoutPanel`,
   `EntitySearcher`). Needs `footActions`/`footMeta`/`statsOverride` +
   `useChassisPatternConfig` adaptation (or the native `pattern` prop).
3. **Sheets** — `MechItemCard`, `PilotSheetItems`, `CrawlerSheetItems`,
   `CrawlerSheet`, `CrawlerIdentity`, `PilotSheet` (status cycle, `footActions`/
   `footMeta`/`cardStyle`/`expand`/`scalingParent`, choice persistence).
4. **Encounter/NPC** — `AddNpcControl`, `EncounterNpcCard` (gated on NPC parity).

- **Hidden consumers:** `useDetailModal` renders RED _inside its modal_ (sheets,
  encounter, GlobalSearch, ClassAbilityTreeDisplay) — re-point it, don't just fix
  the direct JSX. Update every consumer test.
- Risk: high for sheets — verify per surface with screenshots.

> **NOTE (post-Stage-a):** the shim already routes every _direct_ consumer through
> the new card. What remains for b/c is **visual verification** (surfaces render
> correctly through the shim) + re-pointing the legacy-core consumers that still
> import the legacy render core directly — these are the Stage-d delete gate.
>
> **UPDATE (`6575ebf6`) — legacy render core is now DEAD.** The indirect consumers
> are re-pointed: `useDetailModal` (the hidden modal behind sheets/encounter/
> GlobalSearch/ability-tree) + `ClassAbilityTreeDisplay` + `ReferenceEntityDisplayTooltip`
> now render the shim; `GuideEntityListing` dies with the legacy body-part
> `EntityBodySections` (no re-point needed). **Zero live imports of
> `ReferenceEntityDisplay/index` or `ReferenceEntityDisplayContent` remain** outside
> the legacy folder's own stories/tests. Green (typecheck+lint+knip+tests).
> Delete gate is OPEN — but the detail modal / tooltip / ability tree now render
> the NEW card, so do a **screenshot pass on those surfaces before the irreversible
> Stage-d delete**.

### Stage d — delete legacy + canonicalize stories

Only once no consumer references the legacy render core:

- **THIN the folder, don't delete it wholesale.** Delete the RED render core
  (`ReferenceEntityDisplay/index.tsx`, `components/ReferenceEntityDisplayContent.tsx`,
  the `ReferenceEntity*` body-part components, `useReferenceEntityDisplayState`,
  `displayStateContext`, `referenceEntityDisplayTypes`, the 8 `__tests__/*`,
  `ReferenceEntityDisplay.stories`, `ReferenceEntityGrants.stories`).
- **PRESERVE the shared, non-legacy files** the NEW card depends on:
  `referenceEntityStatsConfig` (`buildReferenceEntityStats`),
  `referenceEntityControlTypes` + `referenceEntityControls`, `entityHrefContext`,
  `SectionSeparator`, `components/CalloutMetaStamp`, `referenceEntityHelpers`,
  `BlockContentRendererView`, `choiceCard/*`; and the independent siblings still
  app-consumed: `ActionCard`, `ClassAbilityTreeDisplay`, `NestedChassisAbility`,
  `NestedActionDisplay`, `ReferenceEntityDisplayTooltip`,
  `useChassisPatternConfig`/`useDetailModal`/`getClassSelections` (until their
  consumers no longer render RED).
- Remove the compat shim; consumers call the canonical card directly.
- **Move the stories into the canonical Ladle group** — out of `NEW/` and `Legacy/`
  (drop the prefix, retitle e.g. `Compositions/Reference Entity`), and delete the
  before/after legacy-RED imports in `NEW/*.stories.tsx`.
- Prune the barrel + stale story-coverage `ALLOWLIST`; run the coverage guard.
- **Gate the delete** on `grep -rn "ReferenceEntityDisplay/index\|ReferenceEntityDisplayContent" apps packages`
  returning only the files being deleted.
- Risk: medium — the danger is deleting a shared file or a still-used hook.

---

## Progress tracking

The five stages are tracked as session tasks (Stage 0 → d). Commit per stage; keep
every checkpoint green.
