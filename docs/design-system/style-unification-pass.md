# The Style Unification Pass — Historical Record

> **⚠️ STATUS: COMPLETED — HISTORICAL RECORD. DO NOT WORK FROM THIS DOCUMENT.**
>
> The pass this document ran is over. It is preserved because §2's five governing
> laws are still correct and because it is the record of _how_ the work was done —
> **not** as a work-list. The live documents are
> [`ruleset.md`](./ruleset.md) (the laws — canon; where they disagree, the ruleset
> wins) and [`display-system.md`](../architecture/display-system.md) (the card
> stack as it actually stands).
>
> **The whole ladder in §1 shipped.** Foundations, Atoms, Compositions and
> Containers landed in #466 as the ladder already records. The two rungs still
> marked "← FUTURE" are also done:
>
> - **Entity Display pass** — the `ReferenceEntityDisplay` subtree was replaced by
>   a single `ReferenceEntityCard` plus a typed `controls` API; the migration
>   record is [`entity-card-reconciliation.md`](../design/entity-card-reconciliation.md)
>   and the resulting rules are enshrined in
>   [ADR-026](../adrs/ADR-026-entity-card-design-rules.md).
> - **Dashboard pass** — the instruments were lifted into
>   `packages/component-lib/src/components/dashboard/` and are barrel-exported
>   (`RailBar`, `Dial`, `ActiveItemBand`, `DisplayPanel`, `ActionsDeck`,
>   `SheetHero`).
>
> That also means **§3's "Deferred (do NOT build in this sub-pass)" list is spent** —
> every component it forbids is built and exported. Do not read it as a
> prohibition.
>
> **§5's work-list is five-sixths drained.** `EntityRow`, `Inset`, `Banner`,
> `InlineEditField` and `EntityGrid` all exist in the `component-lib` barrel. The
> one increment that was **never done** is **#2, the ItemCard fold**:
> `apps/itun/src/components/sheet/MechItemCard.tsx` is still live, with two
> consumers (`sheet/PartnerCard.tsx` and `sheet/MechSheet.tsx`). If that fold is
> ever picked up, it is a fresh piece of work — not a resumption of this pass.
>
> **Dead symbols, left uncorrected.** §3's Card law names `footActions`, which has
> **zero occurrences** in `apps/` and `packages/` — the action economy is now
> expressed through the typed `controls` API. `StatsBar` is likewise gone, folded
> into `Card` (the only surviving code reference is the historical comment at
> `packages/component-lib/src/components/shared/Card.tsx:97`). Both are recorded
> here as the API stood when the pass ran. §6's instruction to "work on the 466
> branch" is equally historical — #466 merged long ago.
>
> **Companion design artifacts** (rendered proof from the run; may be private —
> ask the owner to share):
>
> - Inventory map (old → new, lift/keep): <https://claude.ai/code/artifact/4fbcb58a-d92b-4f82-a82b-fc019b17a331>
> - Primitive Rules + Mockups: <https://claude.ai/code/artifact/b857eaef-e92a-4136-af3c-e848d4e62c43>
>
> Everything below §1 is preserved verbatim as the record of what was built and
> why.

---

## 1. What the pass is

One canonical primitive language. Every surface (`srd`, `itun`,
`component-lib`) conforms to the same vocabulary, tokens, and prop APIs. The words
"legacy" and "canon" stop describing our components — they become **the design
system**. The pass proceeds up a ladder, one layer at a time:

```
Foundations (tokens)                                    ← done (#466)
Atoms (11 + StampSeam)                                  ← done (#466, consolidated in the 469 merge)
Compositions (StatusBadge · Tally · VitalGauge · RollTable)  ← done (#466)
Containers (Modal · Tooltip · Toast · EmptyState · Skeleton · InlineRef)  ← done (#466)
Card tidy-up  ← THE CURRENT SUB-PASS (§2)
Entity Display pass (ReferenceEntityDisplay · SheetHero · the *Sheet renders)  ← FUTURE
Dashboard pass (the ITUN dashboard instruments)  ← FUTURE
```

## 2. Governing laws for every run

1. **One kind × one context = one primitive.** A new size/skin/theme reuses a
   primitive with different props — it never spawns a sibling. (ruleset §0.)
2. **Lift shared vocabulary up; apps only re-assemble.** Presentational
   primitives live in `packages/component-lib` (which owns the **one** Ladle
   catalog). `srd` and `itun` are **consumers** — after a lift
   they re-assemble shared primitives + bind data; they hold no bespoke
   presentational CSS. App-domain wiring (routing, IndexedDB stores, the
   workspace/soft-link state, the snapshot backend) stays in the app.
3. **Aesthetic is grounded in the real converted primitives**, then the Salvage
   Union Workshop Manual aesthetic, then real SU-SRD rendering — never an
   idealized reinterpretation. Read the actual component before restyling it.
4. **Mockups show the container, not the entity.** When designing a shell,
   bodies are abstract; real SRD data appears only where it is the primitive's
   own mechanic (a cost, a d20 band, a gauge current/max, a condition badge).
   (This overrides the "1:1 real data" law _for mockups only_.)
5. **Card content is paper** (`--color-paper #fbfaf7`), a filled reading
   surface; it reads as a panel because the surrounding ground is a step
   off-paper — never because the body is tinted. Header/footer are the solid
   ontology-tone bands; the 3px frame **is** the tone.

## 3. The current sub-pass — Card tidy-up

Get the card shell clean and complete **before** the Entity Display pass layers
on more controls. Six in-scope shared primitives; the dashboard instruments and
the entity-content presets are deferred.

**In scope (6):**

| Primitive           | Is                                                                | Used in                                             | Laws                                                                                                                                                                                                                                      | Composes / preset-of                                                      | Must not                                                               |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Card**            | the one entity-container shell                                    | srd Reference · ITUN Live Sheet / Listing / Tooltip | 3px frame = the tone; solid tone header/footer bands; **paper body**; callout stamps ride the top edge (StampSeam); the **foot carries the action economy** (`footMeta` read pairs + `footActions` = Use / Uses ± stepper / Repair, rust) | CardHeader · CardImage · HeaderShell · Footer · ControlButtons · StatsBar | never fork a second card for a new size/skin/context — that's a `mode` |
| **EntityRow**       | header-only clickable listing row                                 | ITUN Roster / Listing                               | header-only, click-through; 6px deep-tone left accent rail; nested entities live in the parent                                                                                                                                            | preset of Card `head` + rail + actions                                    | nothing editable/expandable in place                                   |
| **EntityGrid**      | the entity-card grid + action-economy injector (layout)           | ITUN Live Sheet                                     | 1 col mobile / max 2 col desktop, equal height; `mode="card"` folds foot into each card, `mode="rail"` puts a 152px callout column beside it                                                                                              | wraps Card                                                                | never nest entity grids                                                |
| **InlineEditField** | click-to-edit value (text / number / textarea / labeled Identity) | ITUN Live Sheet                                     | subtle edit cue → input on click; number validates min/max → red + `role=alert`; `readOnly` strips affordances                                                                                                                            | —                                                                         | never in Reference / Tooltip (nothing edits there)                     |
| **Inset**           | boxed sub-panel inside a card's expand slot                       | ITUN Live Sheet                                     | 1.5px ink frame on paper; tone head bar; lives in a parent's expand slot                                                                                                                                                                  | —                                                                         | not a standalone card                                                  |
| **Banner**          | advisory, non-blocking strip                                      | ITUN Live Sheet / Wizard                            | `role=alert` `aria-live=polite`; severity = status tokens; optional Save-anyway / Fix-it (ghost ink, not rust)                                                                                                                            | —                                                                         | never gates/blocks a flow                                              |

**ItemCard is folded into Card** — it is Card `compact` + the
action-economy foot; not a separate primitive.

**Deferred (do NOT build in this sub-pass):**

- **Dashboard pass** — `InstrumentDeck` (ActionsDeck), `Dial`, `RailBar`,
  `ActiveBand` (ActiveItemBand). Too high-level; the ITUN Dashboard needs its own
  design work first (the dark `pc-*` instrument skin, mount state machine, etc.).
- **Entity Display pass** — the `ReferenceEntityDisplay` subtree, `SheetHero`,
  `InstrumentPanel` (DisplayPanel), the full `*Sheet` renders. These render entity
  _content_ + entity-level controls.

## 4. The Ladle conversion convention (per-increment procedure)

The Ladle catalog is **component-lib-only** and reorganizing into single-page
galleries. Namespaces: `Foundations` · `Atoms` · `Compositions` · `Containers` ·
`Reference Entity`, plus **`Legacy`** = the holding pen for unrefreshed
components awaiting rework. Story titles set the namespace (`title: 'Compositions/X'`).

**For each in-scope primitive, one verified commit:**

1. **Lift** the shared presentation from ITUN into `packages/component-lib` (keep
   app-specific data/types/hooks in the app). Skip for Card (already there).
2. **Story** it as a single-page gallery under its namespace, with real SRD data.
   Promote out of `Legacy` if it was parked there; delete the legacy story.
3. **Migrate** the ITUN (and srd) call sites onto the shared primitive.
4. **Delete** the legacy component + its old story. No dual-catalog window, no
   deprecated aliases.
5. **Verify green** before pushing: `bun run typecheck` · `bun run test` ·
   `bun run validate:all` · `bun run knip` (these are the pre-push hooks). One
   primitive per commit; land on the 466 branch (`worktree-entity-card-capture`).

## 5. Migration work-list + order (real consumer footprints)

Measured on the 466 branch (`git grep` importer files, excluding self + tests).
Do smallest blast-radius first:

| Order | Increment       | Old → new                                                                                               | Importers to migrate |
| ----- | --------------- | ------------------------------------------------------------------------------------------------------- | -------------------- |
| 1     | EntityRow       | `roster/EntityListItem` → `EntityRow`                                                                   | 1                    |
| 2     | ItemCard fold   | `sheet/MechItemCard` → Card action-economy foot                                                         | 2                    |
| 3     | Inset           | `sheet/NpcInset` (3) + `sheet/CrawlerEcon` (2) → `Inset`                                                | 5                    |
| 4     | Banner          | `shared/SoftWarningBanner` → `Banner`                                                                   | 3                    |
| 5     | InlineEditField | `sheet/InlineEditField` (5) + `InlineEditTextArea` (4) + `IdentityField` (7) → `InlineEditField` family | 16                   |
| 6     | EntityGrid      | `sheet/Erow`/`Ecflow` + `ActionCardErow` → `EntityGrid`                                                 | ~14                  |

`SoftWarningBanner` pulls `SoftWarning`/`SoftWarningSeverity` types from ITUN's
`lib/rules` — lift the presentation, leave the types + `useSoftWarnings` hook in
the app.

## 6. Environment notes for runs

- Work on the **466 branch** (`worktree-entity-card-capture`) — the design-system
  PR. 469 (`atoms-consolidation`) merged into it; there is one base.
- The Ladle `bun patch` and srd's pinned TS6 are load-bearing — don't
  remove (see the repo memory on the TS7 upgrade).
- Fresh worktrees need `bun install --frozen-lockfile` + `bun run build:package`
  before typecheck/test.
