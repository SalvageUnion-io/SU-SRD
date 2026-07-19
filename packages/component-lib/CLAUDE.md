# component-lib (Shared Component Library)

Shared React component library consumed by both `srd` and `itun`.

## Key Facts

- **No build step** - exports TypeScript source directly via `src/index.ts` barrel ([ADR-011](../../docs/adrs/ADR-011-component-lib-source-no-build.md))
- **Data-source agnostic** - no backend/persistence dependency; consumers inject behavior via slot props, and choice components are persistence-agnostic ([ADR-010](../../docs/adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md))
- Vite in consuming apps handles `.ts/.tsx` compilation
- Uses Tailwind + `cn()` utility for styling

## Contents

- **Theme:** Colors, recipes, design tokens
- **Base typography:** `Text` component
- **UI primitives:** `Toaster` / `toast`, `ModalShell`, `EntityTooltip`
- **Entity display system:** ~58 source files for rendering game data entities (plus tests + stories)
- **Shared components:** `DisplayCard`, `ValueDisplay`, `Stat`, `StatsBar`, `RollTable`, `FilterChip`, etc.
- **Skeletons:** Loading state components
- **Utilities:** `slug()`, `parseTraitReferences()`, `cn()`
- **Constants:** Shared constants

## Entity Display System

The entity display uses **generic slot props** (`afterExtraContent`, `abilitiesSection`, `footerOverride`, etc.) so consuming apps can inject app-specific renderers without the shared library knowing about app-specific concerns. Schema-specific logic is extracted into helper hooks (`useChassisPatternConfig`) and utilities (`getClassSelections`) that return generic override props.

## Stories (Ladle)

Component stories live beside their components (`*.stories.tsx`) and are served by Ladle (`bun run ladle` from the repo root).

**The standard, in one line: ONE public component = ONE co-located story file = ONE nav leaf, titled `Group[/Sub-group]/Component Title Case`.** Every clause is enforced by `src/story-coverage.test.ts`; the contributor-facing explanation lives in [`docs/design-system/ladle-styleguide.md`](../../docs/design-system/ladle-styleguide.md).

- **No multi-component gallery story files.** A story file demonstrates exactly one component. A file that renders several sibling primitives leaves all but one of them with **no sidebar entry at all** — they look covered to a text-matching guard while being undiscoverable in the catalog, which is the exact failure a styleguide exists to prevent.
- **`src/stories/` is for catalog pages only** — the flat set `Styleguide`, `Theme`, `Typography`, `Layout`, `RenderingMatrix`, plus `_harness.tsx`. No subdirectories, and every page there is a `Foundations/*` story. Anything with a backing component belongs beside that component.
- **Sub-groups are sanctioned, not ad-hoc.** Only `Compositions` has them — `Entity`, `Catalog`, `Dashboard`, `Wizard`, `Shell` — and a cluster earns one only at **3+ siblings**; everything else stays a direct leaf. Atoms and Containers are deliberately **flat** lists of peers, which stays scannable and keeps `/` search a single hop. Nesting never exceeds `Group/Sub-group/Leaf`. Adding a sub-group means editing both `SUBGROUPS` in the guard and `storyOrder` in `.ladle/config.mjs`.
- **Titles are unique.** Two files may not claim the same title (it silently collapses the nav).

- **Every story MUST render with real SRD data or real game terms — never lorem/placeholder/invented content.** Drive stories from `SalvageUnionReference.*` fixtures (e.g. `SalvageUnionReference.Chassis.all()[0]`, `SalvageUnionReference.Actions.all()[0]`), and when a prop needs a literal (a label, a stat name, a condition), use the real game term, not a stand-in. A story is a preview of what ships; fake data hides real rendering bugs (overflow, wrapping, tone, empty-state) that only surface with production content.
- **Render entities the way we actually render them.** Feed props exactly as consuming apps do — real values in the real shapes, through the real components (e.g. entities via `ReferenceEntityDisplay`, stats via `Stat`). Don't hand-assemble simplified markup that no app produces; the story must exercise the same path production does.
- Reference data is preloaded by `.ladle/components.tsx` (a `use()` + `Suspense` gate calling `SalvageUnionReference.preload('all')`) — mirror how ITUN's `GameDataReady` and srd's `useGameData` gate. Reading a `SalvageUnionReference.*` model at story-module top level before that gate throws "Schema not loaded" and renders silently blank, so keep new stories consistent with the existing preload pattern.
- **Coverage is enforced in lockstep** by `src/story-coverage.test.ts`: every barrel-exported visual component must be **imported by a story file sitting in its own directory**. When you add a public component to `src/index.ts`, add a story in the same change — the guard fails otherwise. The only escape is its `ALLOWLIST`, reserved for genuine internal sub-parts demonstrated through their parent (each needs a one-line rationale). The guard also fails on **stale** allowlist entries (a name that gained a story, or no longer exists), so prune the allowlist when you story a component or delete one.
  - The same-directory-import rule is deliberate, and replaced a weaker text match. The old guard concatenated every story file and regex-searched for the component's name, so a component counted as "covered" if any story so much as mentioned it — which is how a dozen components ended up with no nav entry of their own. Requiring a **co-located importer** makes coverage mean what the catalog implies: this component has its own page.
- **The taxonomy is enforced too**, by the same test: every story's **meta** `title:` must start with a sanctioned top-level group, use only a sanctioned sub-group, never nest deeper than `Group/Sub-group/Leaf`, and be unique across files. It reads only the default-export meta title, so `title:` strings inside story bodies are ignored. Introduce a new top-level group or sub-group only by extending both the guard's `GROUPS`/`SUBGROUPS` and the `storyOrder` list in `.ladle/config.mjs`.
- **Co-location is enforced too**: a `*.stories.tsx` under `src/stories/` fails the guard unless it is one of the flat catalog pages listed above.
- **The four groups have crisp definitions** (sidebar order, top-to-bottom). These are **membership tests, not rosters** — for the current members, read the catalog (`bun run ladle`), which the coverage guard proves is complete. An enumeration here would be a second source of truth that silently drifts every time a component lands; this file defines the _rule_, the catalog _is_ the list.
  - **Foundations** — design tokens, layout scaffolding, and the QA harness. No product component. Specimens are generated **from the tokens** so they cannot drift from `theme.css`.
  - **Atoms** — primitives with a single presentational job and **no Salvage Union domain knowledge**. An atom **may** compose a lower-level atom: `Stat` composes `Text` + `Tooltip`, `CountStepper` composes `StepButton`. (An earlier version of this rule said atoms compose no other atom — that was never true and isn't a useful line: 7 of 34 atoms compose one, including `Stat`, the flagship of the unification. **Domain knowledge, not composition, is what separates an atom from a composition** — so `CountStepper` is a legitimate atom despite composing `StepButton`, while `StatusBadge` is a Composition despite looking primitive, because it owns the entity-condition vocabulary.)
  - **Containers** — content-agnostic wrappers / state shells that hold or announce arbitrary content, and would still make sense with entirely different content inside.
  - **Compositions** — domain/game components: they know about Salvage Union entities, or they assemble atoms into a product surface.
- **Components are named for what they are** — no `-Display` / `-View` / `-Renderer` suffixes or redundant `Reference*` prefixes (`Stat`, not `StatDisplay`; `Content`, not `BlockContentRendererView`; `CardSkeleton`, not `ReferenceEntityCardSkeleton`).
- **Title + story naming is standardized, and enforced.** The group title is **Title Case with spaces** — `Atoms/Stat`, `Containers/Display Card`, `Compositions/Entity/Content` — and its **last segment must name the component**, so the sidebar can be navigated by the symbol you would grep for. The story **file keeps the component symbol name** (`Stat.stories.tsx`). A sub-group may absorb a shared prefix, so `Compositions/Dashboard/Gauge` legitimately names `DashboardGauge`. A file whose only story is a catch-all "show everything" page exports it as **`Default`** (not `Variants`/`Costs`/etc.).
  - This is a guard assertion, not a convention, because it had already drifted four ways: `Containers/Modal` pointed at `ModalShell`, `Atoms/Activation Cost` at `ActivationCostBox`, `Containers/Toast` at `Toaster`, `Compositions/Live Sheet` at `LiveSheetPoster` — labels that read correctly but match nothing in the code. Where the **symbol** carried a banned implementation suffix it was renamed (`ChangelogView` → `Changelog`, `ActivationCostBox` → `ActivationCost`); where the symbol was fine the **title** was corrected to match it.
- **Stories render on a global paper canvas.** `.ladle/components.tsx` frames every story on `bg-paper` (+ mono, padding), so a story does **not** need its own outer `bg-paper` wrapper. Shared caption/frame helpers that would otherwise be copy-pasted across story files live in `src/stories/_harness.tsx` (e.g. `Caption`) — import them instead of re-declaring a local copy.

## Testing

- Own `bunfig.toml` with happy-dom preload
- No backend env vars needed
- Run: `bun --filter component-lib test`

## Conventions

- Named exports only (via `src/index.ts` barrel)
- Use `cn()` for conditional Tailwind class merging
- Keep components data-source agnostic
- Use `type` over `interface` for props
