# component-lib (Shared Component Library)

Shared React component library consumed by both `srd` and `itun`.

## Key Facts

- **No build step** - exports TypeScript source directly via `src/index.ts` barrel ([ADR-011](../../docs/adrs/ADR-011-component-lib-source-no-build.md))
- **Data-source agnostic** - no backend/persistence dependency; consumers inject behavior via slot props, and choice components are persistence-agnostic ([ADR-010](../../docs/adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md))
- Vite in consuming apps handles `.ts/.tsx` compilation
- Uses Tailwind + `cn()` utility for styling — **being removed** in favour of tokens + style objects + one stylesheet (see [Styling](#styling) below, and epic #802)

## Styling

Tailwind is on its way out of this repo (#802). The pattern replacing it is three
files, and every component migrated from here on lands on them:

| File | Role |
| --- | --- |
| [`src/design/tokens.ts`](src/design/tokens.ts) | The typed token scale — colour, space, font size, weight, tracking, radius, border width. Plain `as const` objects, no dependency. |
| [`src/design/styles.ts`](src/design/styles.ts) | Exported `React.CSSProperties` objects for **static** styling, each `satisfies` the type. |
| [`src/styles/index.css`](src/styles/index.css) | The **one** stylesheet a web consumer loads. Emits the scale as `--su-*` custom properties, binds the page ground and body face, and carries every rule a style object cannot express. |

Both halves of the pattern are load-bearing. The token scale and the style objects
are the visible half; the stylesheet is the half that is easy to miss, and
dropping it would be a functional regression rather than a styling change.

### The split rule

- **Style object** — static values that never vary by interaction or viewport:
  colour, padding, font, border, layout.
- **Stylesheet class** — anything stateful or conditional: `:hover`,
  `:focus-visible`, `:disabled`, `@media`, pseudo-elements, sibling/child
  selectors.
- A component may use both. The object goes on `style=`, the class on
  `className=`.

This is a capability boundary, not a preference: an inline `style={}` object has
no way to express a single item on the second list. That matters here more than
it looks. Measured across the three UI workspaces, the codebase depends on ~403
Tailwind variant usages — 215 responsive (`sm:`/`md:`/`lg:`/`xl:`), 120 `hover:`,
15 `focus-visible:`, 12 `disabled:`, 9 `focus:`, 5 structural. A migration to
style objects alone would silently drop every one of them.

(The pattern is ported from `binfinite-app`, whose component library has zero
`:hover` and zero `@media` because it is React-Native-first and RN has neither —
so its style objects were never asked to carry interaction or viewport state.
Here they would be, and they cannot. That is the one thing that must not be lost
in translation, and it is why the stylesheet is not optional.)

### Migration status (#799, epic #802)

Migrating by Ladle group, one PR per group: **Foundations ✅ → Atoms → Containers
→ Compositions.** A group is done when no file in it carries a Tailwind class.

### While both systems are live

`src/styles/theme.css` is still the source of record and Tailwind still works
untouched: the token scale is a re-shaping of the values already in that file,
not a re-design. The `--su-*` namespace exists so the two can coexist in one
build until Tailwind is dropped.

**`src/styles/ladle.css` must import `index.css` into `layer(su-base)`, and this
is load-bearing.** `index.css` is written to be loaded alone once Tailwind
leaves, so its base block is unlayered — and unlayered CSS beats layered CSS
whatever the source order, while Tailwind v4 puts its utilities in
`@layer utilities`. A plain `@import` therefore inverts the cascade for every
rule the two share: measured on the real build, `h1,…,h6 { font-size: inherit }`
landed past the end of the utilities layer and outranked every `text-*` utility,
collapsing the type on every heading in the catalog. Ladle is the only surface
with this problem, because it is the only one that renders both systems at once;
an app imports `index.css` directly, unlayered, as designed.

**Two rungs the token scale was missing, and ~17 more it still is.** `ink15` /
`ink10` were added because `border-ink/15` and `border-ink/10` are in live use
and had nowhere exact to land. That is not a one-off: Tailwind's `/NN` opacity
modifier is an OPEN mechanism and `tokens.ts` is a CLOSED set. **34 alpha usages
across 17 non-story files still have no matching rung**, in 17 distinct
spellings — `ink/5`, `ink/35`, `ink/55`, `ink/60`, `ink/70`, `paper/10`,
`paper/15`, `paper/40`, `paper/55`, `paper/70`, `paper/80`, `paper/85`,
`paper/95`, `rust/25`, `caution/25`, `status-bad/25`, `wk-faint/80`. Rounding one
to a neighbouring rung is a re-tone, and a raw `rgb(… / .NN)` at the call site is
a `check:tokens` `raw-color` violation, so adding rungs is the only legal move —
but which rungs the system should own enlarges the closed colour set and is a
design call, not a port. Tracked on #799.

**The Atoms layer is blocked on five of them**: `paper/70` (Stat), `ink/55` +
`ink/70` (VitalGauge), `rust/25` (Toggle), `status-bad/25` (InlineEditField).
Containers needs seven more, Compositions the rest.

**A catalog-only rule goes in `src/stories/_stories.css`, not `index.css`.** The
split rule sends anything stateful or responsive to a stylesheet class, but
`index.css` is the one stylesheet a *consumer* loads — story-page layout ships in
no app. The underscore is the same story-scaffolding marker as `_harness.tsx`.

The scale therefore exists twice — once as TypeScript, once as custom properties
— because neither form can serve the other's job. `src/design/tokens.parity.test.ts`
fails if they disagree, so **edit both or neither**.

## Contents

There is deliberately **no roster here.** [`src/index.ts`](src/index.ts) is the public API
and the only trustworthy list of what this package exports — read it. A
hand-maintained enumeration in a doc is a second source of truth that drifts
silently every time a component lands or is deleted, and this file had twice
grown one full of names that no longer existed.

- For the export surface: the barrel, [`src/index.ts`](src/index.ts).
- For the rules governing that surface (what may be exported, what consumers may
  import): [`docs/architecture/package-contracts.md`](../../docs/architecture/package-contracts.md).
- For a browsable, rendered catalog: `bun run ladle` — the story-coverage guard
  proves it covers every public visual component.

## Entity Display System

The entity display uses **generic slot props** (`afterExtraContent`, `abilitiesSection`, `footerOverride`, etc.) so consuming apps can inject app-specific renderers without the shared library knowing about app-specific concerns. Schema-specific logic is extracted into helper hooks (`useChassisPatternConfig`) and utilities (`getClassSelections`) that return generic override props.

## Stories (Ladle)

Component stories live beside their components (`*.stories.tsx`) and are served by Ladle (`bun run ladle` from the repo root).

**The standard, in one line: ONE public component = ONE co-located story file = ONE nav leaf, titled `Group[/Sub-group]/Component Title Case`.** Every clause is enforced by `src/story-coverage.test.ts`; the contributor-facing explanation lives in [`docs/design-system/ladle-styleguide.md`](../../docs/design-system/ladle-styleguide.md).

- **No multi-component gallery story files.** A story file demonstrates exactly one component. A file that renders several sibling primitives leaves all but one of them with **no sidebar entry at all** — they look covered to a text-matching guard while being undiscoverable in the catalog, which is the exact failure a styleguide exists to prevent.
- **`src/stories/` is for catalog pages only** — the flat set `Styleguide`, `Theme`, `Typography`, `Layout`, `RenderingMatrix`, plus `_harness.tsx`. No subdirectories, and every page there is a `Foundations/*` story. Anything with a backing component belongs beside that component.
- **Sub-groups are sanctioned, not ad-hoc.** Only Compositions has them — Entity, Catalog, Dashboard, Wizard, Shell — and a cluster earns one only at **3+ siblings**; everything else stays a direct leaf. Atoms and Containers are deliberately **flat** lists of peers, which stays scannable and keeps `/` search a single hop. Nesting never exceeds `Group/Sub-group/Leaf`. Adding a sub-group means editing both `SUBGROUPS` in the guard and `storyOrder` in `.ladle/config.mjs`.
- **Titles are unique.** Two files may not claim the same title (it silently collapses the nav).

- **Every story MUST render with real SRD data or real game terms — never lorem/placeholder/invented content.** Drive stories from `SalvageUnionReference.*` fixtures (e.g. `SalvageUnionReference.Chassis.all()[0]`, `SalvageUnionReference.Actions.all()[0]`), and when a prop needs a literal (a label, a stat name, a condition), use the real game term, not a stand-in. A story is a preview of what ships; fake data hides real rendering bugs (overflow, wrapping, tone, empty-state) that only surface with production content.
- **Render entities the way we actually render them.** Feed props exactly as consuming apps do — real values in the real shapes, through the real components (e.g. entities via `ReferenceEntityCard`, stats via `Stat`). Don't hand-assemble simplified markup that no app produces; the story must exercise the same path production does.
- Reference data is preloaded by `.ladle/components.tsx` (a `use()` + React Suspense gate calling `SalvageUnionReference.preload('all')`) — mirror how ITUN's GameDataReady and srd's `useGameData` gate. Reading a `SalvageUnionReference.*` model at story-module top level before that gate throws "Schema not loaded" and renders silently blank, so keep new stories consistent with the existing preload pattern.
- **Nothing lives only in the catalog.** A module whose only importers are `.stories.tsx` files is a prototype the catalog is keeping alive: it ships in no app, is exercised by no test, and still has to be read, refactored and kept compiling by everyone who touches the package. Delete it, or move it to a **harness** file — a leading underscore (`_harness.tsx`, `_dashboardStage.tsx`) marks shared story scaffolding and is exempt by naming, not by allowlist. Explore in a branch or a design doc; the catalog demonstrates what ships. Enforced by `story-coverage.test.ts`. This is the same rule as for test-only code, and it **cascades** — when `LiveSheetPoster` (621 Ladle-only lines) was deleted it orphaned `UsedPip`, which the guard caught on the next run, so re-run it after any such deletion. Both names are gone from the package; they are recorded here as the worked example.
- **Coverage is enforced in lockstep** by `src/story-coverage.test.ts`: every barrel-exported visual component must be **imported by a story file sitting in its own directory**. When you add a public component to `src/index.ts`, add a story in the same change — the guard fails otherwise. The only escape is its `ALLOWLIST`, reserved for genuine internal sub-parts demonstrated through their parent (each needs a one-line rationale). The guard also fails on **stale** allowlist entries (a name that gained a story, or no longer exists), so prune the allowlist when you story a component or delete one.
  - The same-directory-import rule is deliberate, and replaced a weaker text match. The old guard concatenated every story file and regex-searched for the component's name, so a component counted as "covered" if any story so much as mentioned it — which is how a dozen components ended up with no nav entry of their own. Requiring a **co-located importer** makes coverage mean what the catalog implies: this component has its own page.
- **The taxonomy is enforced too**, by the same test: every story's **meta** `title:` must start with a sanctioned top-level group, use only a sanctioned sub-group, never nest deeper than `Group/Sub-group/Leaf`, and be unique across files. It reads only the default-export meta title, so `title:` strings inside story bodies are ignored. Introduce a new top-level group or sub-group only by extending both the guard's `GROUPS`/`SUBGROUPS` and the `storyOrder` list in `.ladle/config.mjs`.
- **Co-location is enforced too**: a `*.stories.tsx` under `src/stories/` fails the guard unless it is one of the flat catalog pages listed above.
- **The four groups have crisp definitions** (sidebar order, top-to-bottom). These are **membership tests, not rosters** — for the current members, read the catalog (`bun run ladle`), which the coverage guard proves is complete. An enumeration here would be a second source of truth that silently drifts every time a component lands; this file defines the _rule_, the catalog _is_ the list.
  - **Foundations** — design tokens, layout scaffolding, and the QA harness. No product component. Specimens are generated **from the tokens** so they cannot drift from `theme.css`.
  - **Atoms** — primitives with a single presentational job and **no Salvage Union domain knowledge**. An atom **may** compose a lower-level atom: `Stat` composes `Text` + `Tooltip`, `CountStepper` composes `StepButton`. (An earlier version of this rule said atoms compose no other atom — that was never true and isn't a useful line: 7 of 34 atoms compose one, including `Stat`, the flagship of the unification. **Domain knowledge, not composition, is what separates an atom from a composition** — so `CountStepper` is a legitimate atom despite composing `StepButton`, while `StatusBadge` is a Composition despite looking primitive, because it owns the entity-condition vocabulary.)
  - **Containers** — content-agnostic wrappers / state shells that hold or announce arbitrary content, and would still make sense with entirely different content inside.
  - **Compositions** — domain/game components: they know about Salvage Union entities, or they assemble atoms into a product surface.
- **Components are named for what they are** — no `-Display` / `-View` / `-Renderer` suffixes or redundant `Reference*` prefixes. Each of these was renamed to its bare form and the suffixed name no longer exists: `StatDisplay` → `Stat`, `BlockContentRendererView` → `Content`, `DisplayView` → `DisplayPanel`.
  - **`ReferenceEntityCard` is a sanctioned exception — do not re-flag it.** Here `Reference*` is a **domain qualifier, not a redundant prefix**: it is the card whose `data` prop is a `SURefEntity` (reference data from the `salvageunion-reference` ORM), as opposed to `Card`, the content-agnostic shell the player-data surfaces build on. [`docs/architecture/display-system.md`](../../docs/architecture/display-system.md) and [`.claude/rules/display-system.md`](../../.claude/rules/display-system.md) both name the two side by side as the two card shells and state they are deliberately **not** merged, so collapsing the name to EntityCard would erase the one word carrying that distinction — and EntityCard is already taken by a private, unexported helper in `dashboard/DisplayPanel.tsx`. The prefix earns its place; the rule targets prefixes that restate the component's own directory with no added meaning.
  - The bar for an exception is that the prefix/suffix **carries information the bare name loses** — not that the rename would be laborious. Reach for it rarely, and record it here when you do.
- **Title + story naming is standardized, and enforced.** The group title is **Title Case with spaces** — `Atoms/Stat`, `Containers/Card`, `Compositions/Entity/Content` — and its **last segment must name the component**, so the sidebar can be navigated by the symbol you would grep for. The story **file keeps the component symbol name** (`Stat.stories.tsx`). A sub-group may absorb a shared prefix, so `Compositions/Dashboard/Gauge` legitimately names `DashboardGauge`. A file whose only story is a catch-all "show everything" page exports it as **`Default`** (not Variants / Costs / etc.).
  - This is a guard assertion, not a convention, because it had already drifted four ways: `Containers/Modal` pointed at `ModalShell`, `Atoms/Activation Cost` at `ActivationCostBox`, `Containers/Toast` at `Toaster`, `Compositions/Live Sheet` at `LiveSheetPoster` — labels that read correctly but match nothing in the code. Where the **symbol** carried a banned implementation suffix it was renamed (`ChangelogView` → `Changelog`, `ActivationCostBox` → `ActivationCost`); where the symbol was fine the **title** was corrected to match it.
- **Stories render on a global paper canvas.** `.ladle/components.tsx` frames every story on `bg-paper` (+ mono, padding), so a story does **not** need its own outer `bg-paper` wrapper. Shared caption/frame helpers that would otherwise be copy-pasted across story files live in `src/stories/_harness.tsx` (e.g. `Caption`) — import them instead of re-declaring a local copy.

## Testing

- Own `bunfig.toml` with happy-dom preload
- No backend env vars needed
- Run: `bun --filter component-lib test`

## Conventions

- Named exports only (via `src/index.ts` barrel)
- Use `cn()` for conditional Tailwind class merging — on surfaces still on Tailwind. New and migrated styling follows the [split rule](#the-split-rule) instead.
- Keep components data-source agnostic
- Use `type` over `interface` for props
