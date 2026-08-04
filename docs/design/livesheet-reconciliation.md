# Live Sheet Reconciliation — Working Reference

The reconciliation of ITUN's **live sheets** (pilot / mech / crawler) onto the
canonical primitive language — the same three-level loop that produced the
entity card ([`entity-card-reconciliation.md`](./entity-card-reconciliation.md)),
applied to the sheet **shell**. The entity cards inside the sheets are already
canonical (`ReferenceEntityCard`); this pass is the **frame, top bar, identity
band, vitals/gauges, section framing, region arrangement, image affordance, and
the responsive story** — never an entity-card rewrite.

> **STATUS: direction committed (Pilot); the artifact is gone.** The Pilot
> poster was built from existing primitives as `Compositions/Live Sheet` and has
> since been **deleted** under the rule that nothing lives only in the Ladle
> catalog — it had no consumer but its own story. The legacy "before" capture
> and the Legacy → New comparison were removed earlier, on committing to the
> direction.
>
> So the surviving record of this direction is the L1 brainstorm at
> `docs/design/livesheet-mockup.html`, this document, and git history. Remaining
> work is unchanged in substance but different in shape: mech and crawler no
> longer have a working sibling to match, so the next build should go straight
> to L3 — a real component wired to ITUN data/store — rather than reconstructing
> a Ladle-only poster first.

---

## Why this pass

Three drivers, all confirmed this round:

1. **Harmonize with the canon.** After the style-unification + entity-card
   refresh (PR #466), the sheet shell should read as a sibling of the rest of
   the system — one paper, one action colour (rust), the shared border/type/
   radius scales, `Stamp`/`Slab`/`Card`/`Stat`/`VitalGauge`. Today the
   sheet shell still carries pre-canon drift (arbitrary `text-[30px]` /
   `tracking-widest` / `rounded-[8px]`, local `TpBlock`, hand-rolled rows).
2. **Resemble the official Starter Set sheets.** A two-column poster of labeled
   regions, single-accent monochrome, current/max vitals — rendered **in our
   primitives**, not a photocopy of the PDF. (See
   [`itun-sheet-redesign-plan.md`](./itun-sheet-redesign-plan.md) for the
   region-for-region gap analysis and the confirmed direction.)
3. **Reserve for a user image.** NEW this pass: every sheet must anticipate a
   user-provided image (pilot portrait / mech art / crawler art) — a feature not
   yet built. The poster must look intentional both empty (a dashed
   `EmptyState`-style drop zone) and filled (framed art in the identity region),
   and must never distort the grid when absent.

---

## The methodology (same three-level loop)

- **L1 — real "before" + brainstorm mockup.** The "before" is the _actual_
  current sheet reproduced from real code + real ORM data (never a caricature);
  the target is designed as an artifact.
- **L2 — build the target alongside as canonical primitives**, iterated in
  three-way Ladle stories (old · new read-only · new editable), Ladle-only (no
  consumers) so iteration is zero-risk.
- **L3 — reconciliation / cutover**, green at every checkpoint, on explicit
  command.

**Invariants:** read-only-first; real data everywhere; green at every checkpoint
(typecheck + lint + tests + `validate:all`); prefer data-shape changes over
renderer special-cases; the SRD reference site is untouched (ITUN-only shell).

### Dependency-graph constraint (why the "before" is a reproduction)

The sheets live in **`apps/itun`**; component-lib **cannot import the
app** (the dependency runs app → lib), and ITUN has **no Ladle** of its own. So
the L1 "before" is a _faithful presentational reproduction_ built inside
component-lib from real ORM data — every region, class string, and primitive
mirrors the shipped sheet (with file anchors in the source header). This is also
the seed that L2/L3 converge into a shared **`Compositions/Live Sheet`**
primitive: the endgame is the sheet _becoming_ a component-lib composition, the
same arc the entity card followed.

---

## Where we are now

- **L1 Pilot before — DONE, then REMOVED.** The `Legacy/Live Sheet` capture
  (`stories/legacy/`) reproduced the shipped Pilot sheet from real ORM data and
  served as the "before". Once the direction was committed it was **deleted**
  along with the comparison — the new poster is the single source of truth.
- **L1 brainstorm mockup — DONE.** `docs/design/livesheet-mockup.html` — a
  Fable-authored design deck exploring the reconciled direction for all three
  sheets (desktop + mobile), the image affordance (empty + filled), and a
  decisions/variations panel. Built from the canonical vocabulary + tokens.
- **L2 Pilot target — DONE, then DELETED.** The poster lived at
  `packages/component-lib/src/components/livesheet/` and was removed under the
  standing rule that a component whose only consumer is its own story does not
  stay in the tree. It was the clearest case in the repo: 621 lines reachable
  only from Ladle. The direction it proved is preserved in the L1 mockup above
  and in git history (`git show 046b244a~1 -- '*LiveSheetPoster*'`); when mech
  and crawler are built, rebuild the pilot poster alongside them against real
  app consumers rather than restoring a Ladle-only artifact.

  What it was:
  `LiveSheetPoster.tsx` + `LiveSheetPoster.stories.tsx`, titled
  `Compositions/Live Sheet`. The "Union Poster" **assembled entirely from
  existing primitives** — `Card` (identity + vitals bands), `VitalGauge`
  (kept — segmented), `Stat` (TP box), `Badge` stamp (field labels), `Slab`
  (section headers), `ReferenceEntityCard` (ability/equipment rows, compact),
  `ConditionSwatch`, `EmptyState` (the empty image seat). Read-only + editable +
  390px mobile stories on real ORM data. Whitespace/legibility-first; the
  linked-player-entity rail stays at the bottom. Ladle-only, not barrel-exported.
  Both identity + vitals bands carry the accent header.

- **L2 Legacy → New comparison — DONE, then REMOVED.** The three-way
  `Comparison` story (before · new read-only · new editable, one shared
  `pilotFixture`) served the review; it was deleted with the legacy capture on
  committing to the direction. The poster stories are now `Compositions/Live
Sheet` → `Pilot` (read-only) · `Editable` · `Mobile`.
- **Mech + Crawler target — TODO.** The pilot poster was the reference
  implementation and has since been deleted (see above), so this now starts
  from the L1 mockup and the primitives themselves rather than from a working
  sibling. Mech
  (Identity + ChassisStats ∥ SP/EP/Heat vitals — Heat gauge redlines near cap;
  **Chassis Ability rendered through `ReferenceEntityCard`, matching the SRD
  reference-entity chassis-ability rendering**; Systems ∥ Modules; Hold) and
  crawler (Identity + Economy ∥ full-height Storage rail; Bays; Weapons) reuse
  the same parts. Legacy before-captures for mech/crawler follow alongside.
- **L3 — not started.**

---

## The target constraints (fixed)

From the redesign plan + this round's additions:

- **One accent per sheet** from the `--tone` tokens (pilot orange / mech teal /
  crawler magenta), via the `.sheet--{pilot,mech,crawler}` classes (now sourced
  in component-lib `theme.css`).
- **Entities are always entity-cards** (`ReferenceEntityCard`), max **2 columns**
  on desktop, **1** on mobile; default to compact header-only clickable rows.
  The only non-entity-card UI is the sheet **shell** (frame, top bar, gauges,
  identity fields, image affordance).
- **No vertical edge wordmark** — the slim top bar stays as the sheet's chrome.
- **Mobile = single-column** stack in poster reading order (identity → image →
  vitals → abilities → inventory for pilot; analogous for mech/crawler). No
  horizontal scroll; ≥44px tap targets.
- **Click-to-edit per container** — no global edit mode, no always-open inputs;
  collections have an always-visible rule-gated `+ Add`; vitals gauges always
  live. Three edit archetypes (Add/Remove · click-to-edit field · dots/pips).
- **Image affordance** — a reserved region per sheet with an empty (dashed drop
  zone, the `EmptyState` primitive) and filled (framed art) state, same size so
  the poster never reflows between them; complete without it.
- **Whitespace + legibility first** — readable and playable **without zoom**;
  airy gaps, generous line-height, larger value type. **Assemble from existing
  parts** — very little should be created wholesale.
- **Keep the segmented `VitalGauge`** (decision resolved — no dial/ring).
- **Chassis Ability (mech) renders through `ReferenceEntityCard`**, matching the
  SRD reference-entity chassis-ability rendering — never a bespoke render.
- Live-play interactivity + the three modes (read-only snapshot / editable
  live-play / per-section build edit) from `sheetViewProps.ts`; snapshot + print
  support; ADR-007 automation boundary. SRD reference site untouched.

---

## Decisions — RESOLVED this round

1. **Image placement** ✅ — a reserved seat inside the identity `Card`:
   a 3:4 **portrait-left** for pilots; the same seat stretches to a **banner**
   for mech/crawler art. Empty = the same seat as an `EmptyState` dropzone.
2. **Vitals gauge** ✅ — **keep the segmented `VitalGauge`** (no dial/ring). Heat
   redlines its top segments near cap (mech).
3. **Section framing** ✅ — lighter **`Slab`** headers for collection sections;
   `Card` only frames the identity + vitals bands.
4. **Where the canonical primitive lives** ✅ — one **shell, three variants**
   ("so the three screens cannot drift apart," matching today's `LiveSheet`).
   The Pilot poster's sub-parts (image seat, field grid, vitals band, collection
   section, linked rail) are variant-agnostic and reused for mech/crawler.

### Still open (refine in mech/crawler)

- **Identity band composition** — field density; how the mech **source-pattern**
  reads as secondary meta under the prominent pattern name.
- **Filled-image treatment** — the real user-image render (this pass ships the
  seat + empty state; filled uses a placeholder until the feature lands).

---

## Next steps

1. Screenshot-review the Pilot `Legacy/Live Sheet` story + the mockup deck; pick
   the primary direction and settle the open decisions above.
2. L2: build the target shell as canonical primitives in component-lib
   (Ladle-only), three-way stories, Pilot first.
3. Mech + Crawler before-captures + target parity.
4. L3 cutover: migrate ITUN's `LiveSheet`/`SheetHero`/`*Sheet` onto the shared
   composition, delete the pre-canon local shell pieces (`TpBlock`, hand-rolled
   identity/conditions markup), green at every checkpoint.
