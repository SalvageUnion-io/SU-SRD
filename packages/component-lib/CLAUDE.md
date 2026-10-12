# component-lib (Shared Component Library)

Shared React component library consumed by both `srd` and `itun`.

## Key Facts

- **No build step** - exports TypeScript source through the `src/index.ts` barrel, named exports only ([ADR-011](../../docs/ARCHITECTURE.md#decisions))
- **Data-source agnostic** - keep components free of any backend/persistence dependency; consumers inject behavior via slot props, and choice components are persistence-agnostic ([ADR-010](../../docs/ARCHITECTURE.md#decisions))
- Vite in consuming apps handles `.ts/.tsx` compilation
- **`sideEffects` is CSS only** (`package.json`): bundlers drop any module whose exports go unused. Never rely on an import running code; if a module truly must, add it to that list ([dependencies](../../docs/ARCHITECTURE.md#areas))
- **Design intent:** [the origin](https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm) is the source of truth ("board 05c" names one of its boards); [`ruleset.md`](../../docs/design-system/ruleset.md) codifies it and yields where they disagree

## Styling

Tokens, style objects and one stylesheet (ADR-046). The working rules (the
per-property style-object/`.su-*` split, token parity, the one stylesheet
entry) are [`.claude/rules/styling.md`](../../.claude/rules/styling.md), which
loads with any stylesheet or `src/design/` file. Read it before restyling a
component.

## Contents

No roster here: the barrel, [`src/index.ts`](src/index.ts), is the public API and the only
list of exports — read it. The rules for that surface (what may be exported, what consumers may
import): [packages and contracts](../../docs/ARCHITECTURE.md#areas). The rendered catalog:
[`apps/catalog`](../../apps/catalog/) (`bun run stories`).

## Entity Display System

Forms per the [entity display language](../../docs/design-system/entity-display-language.md): Row, Token, Mention and Peek in `src/entity/`; Card and Page are `ReferenceEntityCard`.

Apps inject their renderers through **generic slot props** (`afterExtraContent`, `abilitiesSection`, `footerOverride`, …), so the library knows nothing app-specific. Schema-specific logic lives in helper hooks (`useChassisPatternConfig`) and utilities (`getClassSelections`) that return generic override props.

## Stories

**The standard, in one line: ONE public component = ONE co-located story file = ONE nav leaf, titled `Group[/Sub-group]/Component Title Case`.** The catalog's `story-coverage.test.ts` enforces every clause; explained in [component catalog](../../docs/ARCHITECTURE.md#areas).

- **The catalog also serves the apps' own components.** A composition only one app renders lives in that app's `src/components/`, story beside it; the catalog globs both ([component-lib](../../docs/ARCHITECTURE.md#areas)). A primitive (an Atom or a Container) stays here however many apps render it. The story's group is the classification: `bun run check barrel-consumers` fails a barrel export only one app reaches whose story files it under `Compositions/`. The rules below apply to app stories too (the guard scans all three roots); coverage is this package's barrel only. App stories take `Story` and `Caption` from `component-lib/stories/harness`.
- **Coverage, in lockstep:** every barrel-exported visual component must be **imported by a story file in its own directory** (a story that merely names it gives it no page). Add a public component to `src/index.ts` and its story in the same change. The only escape is the guard's `ALLOWLIST`, for genuine internal sub-parts shown through their parent, each with a one-line rationale; the guard fails on **stale** entries, so prune it when you story or delete one.
- **No multi-component gallery story files.** A story file demonstrates exactly one component; a file rendering several siblings leaves all but one with **no sidebar entry**.
- **`src/stories/` is for catalog pages only** — the flat `Foundations/*` set `Styleguide`, `Theme`, `Typography`, `Layout`, `Sizing`, `RenderingMatrix`, plus underscore scaffolding (`_harness.tsx`, `_groups.ts`, `_stories.css`, `_themeTokens.ts`, `_foundations.tsx`). No subdirectories; any other `*.stories.tsx` there fails the guard.
- **Titles:** the default-export meta `title:` starts with a sanctioned group, uses only a sanctioned sub-group, nests no deeper than `Group/Sub-group/Leaf`, and is unique across files (a duplicate collapses the nav). It is **Title Case with spaces** and its **last segment names the component** (`Atoms/Stat`, `Compositions/Entity/Content`); the file keeps the symbol name (`Stat.stories.tsx`). A sub-group may absorb a shared prefix (`Compositions/Dashboard/Gauge` is DashboardGauge). A file whose only story is a catch-all page exports it as **`Default`**.
- **Sub-groups:** only Compositions has them (Entity, Catalog, Dashboard, Wizard, Shell), and a cluster earns one only at **3+ siblings**; Atoms and Containers stay flat. A new group or sub-group means editing `storyGroups` / `storySubgroups` in `src/stories/_groups.ts`, which the guard and the sidebar both read.
- **The four groups are membership tests, not rosters** (the catalog is the list), in sidebar order:
  - **Foundations** — tokens, layout scaffolding, the QA harness; no product component. Specimens are generated **from the tokens** so they cannot drift from `theme.css`.
  - **Atoms** — a single presentational job and **no Salvage Union domain knowledge**. An atom may compose a lower atom (`Stat` composes `Text` + `Tooltip`); domain knowledge, not composition, makes a Composition (`StatusBadge` owns the condition vocabulary).
  - **Containers** — content-agnostic wrappers / state shells that would make sense with entirely different content inside.
  - **Compositions** — know about Salvage Union entities, or assemble atoms into a product surface.
- **Name components for what they are** — no `-Display` / `-View` / `-Renderer` suffixes or redundant `Reference*` prefixes (`Stat`, never `StatDisplay`). A banned suffix means renaming the symbol; otherwise fix the title. **`ReferenceEntityCard` is a sanctioned exception — do not re-flag it:** `Reference*` marks the card over a `SURefEntity`, distinct from the content-agnostic `Card` (see [`.claude/rules/display-system.md`](../../.claude/rules/display-system.md)). An exception's prefix must carry information the bare name loses; record any new one here.
- **Real data only — never lorem or invented content.** Drive stories from `SalvageUnionReference.*` (`SalvageUnionReference.Chassis.all()[0]`) and use real game terms for literals, fed exactly as the apps feed them, through the real components (entities via `ReferenceEntityCard`, stats via `Stat`) — never markup no app produces.
- The catalog awaits `SalvageUnionReference.preload('all')` before importing any story; reading a model at module top level in anything a story imports before that throws "Schema not loaded".
- **Nothing lives only in the catalog, or only in a test.** A module whose only importers are stories or tests ships in no app: delete it, or make it a **harness** file (a leading underscore, as `_harness.tsx` and ITUN's `_dashboardStage.tsx`, exempt by naming). The guard cascades — one deletion can orphan another module — so re-run it after deleting.
- **Stories render on a global paper canvas, in Barlow:** no outer `bg-paper` wrapper; a wrapper fills the frame (no `w-fit` card). Import shared helpers (`Caption`) from `src/stories/_harness.tsx` rather than re-declaring them.

### Capturing a story

Run your own server (`bunx vite --port N --strictPort` in `apps/catalog`), find the id with `bun run stories:ids [filter]` or `?mode=index`, and open `/?story=<id>&mode=canvas&width=phone` at viewport >= preset (else it overflows): the story alone, `phone` 375, `column` 480, `page` 1200 or px. Each entity-card matrix cell is a story (`…--size-by-extent-medium-head`).

## Testing

`bun --filter component-lib test`: its own `bunfig.toml` (happy-dom preload), no backend env vars.
