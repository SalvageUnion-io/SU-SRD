# Ladle as the Styleguide

How this repo uses [Ladle](https://ladle.dev) as the one catalog of its design
system. The enforced story rules are in
[`packages/component-lib/CLAUDE.md`](../../packages/component-lib/CLAUDE.md);
this doc explains the setup behind them and does not override them. The laws the
catalog demonstrates are [ruleset.md](./ruleset.md). Section numbers are cited
from `.ladle/config.mjs`; keep them stable.

> **TL;DR.** One catalog, in `packages/component-lib`; run it with
> `bun run ladle`. Every public component has a co-located `*.stories.tsx` (a
> test enforces it). Stories are plain `Story` function components, titled
> `Group[/Sub-group]/Title Case`, driven by **real SRD data**, with interactivity
> as plain `useState` — no args, controls, decorators or MSW. Do not import from
> `@ladle/react` without reading §9.

## 1. Why Ladle

Vite-native with no bundling step, so it consumes the same TypeScript source the
apps do — `component-lib` has no build ([ADR-011](../adrs/ADR-011-component-lib-source-no-build.md)).
A styleguide is only trustworthy if **every public component appears** (§7) and
**every story shows production-real content** (§6).

## 2. Where it lives

```
packages/component-lib/
  .ladle/config.mjs        # story roots, sidebar order, shell relayout, a11y addon
  .ladle/components.tsx    # the one Provider: paper canvas + data preload gate
  vite.config.ts           # consumed ONLY by Ladle
  src/styles/ladle.css     # Tailwind + the package stylesheet, for Ladle alone
  src/stories/             # catalog pages only (Foundations/*), plus _harness.tsx
  src/**/X.stories.tsx     # component stories, beside their component
  src/story-coverage.test.ts
```

The catalog globs three roots: the library's own `src/`, plus
`apps/itun/src/components/` and `apps/srd/src/components/` for app-owned
components (they left the library but keep their pages). The apps have no Ladle
config or dependency of their own.

| Command                                    | Does                        |
| ------------------------------------------ | --------------------------- |
| `bun run ladle`                            | dev catalog with HMR        |
| `bun --filter component-lib ladle:build`   | static build into `build-ladle/` (CI runs it) |

## 3. Config

`config.mjs` runs in **both** the Node CLI and the browser. Its `storyOrder`
function is serialized and re-evaluated in the browser **without its module
scope**, so it must stay self-contained — no imports, no outer helpers.
`components.tsx` is browser-only; that is where React, global CSS and providers
live. `defaultStory` opens on `foundations--styleguide--overview` (a story id
joins title segments and the export name with `--`).

## 4. The Provider

`.ladle/components.tsx` (props typed locally, see §9) wraps every story in the paper canvas and a **data
preload gate**. Stories read `SalvageUnionReference.*` at module top level, which
runs the instant Ladle imports the story's chunk; without the gate every model
access throws "Schema not loaded" and the story renders **silently blank**. The
`use()` + `Suspense` gate mirrors ITUN's `GameDataReady` and srd's
`useGameData`. Because the canvas is global, a story must not add its own outer
`bg-paper` wrapper.

## 5. Styling

### 5.1 The Vite config is Tailwind-only

**Do not add `@vitejs/plugin-react` to `vite.config.ts`.** Ladle registers its
own; a second one crashes every transform with `Missing field 'moduleType'` and
every story renders blank.

### 5.2 The CSS entry

`src/styles/ladle.css` loads Tailwind and the package stylesheet together,
importing the latter into `layer(su-base)` — load-bearing, see the file header —
and points Tailwind's `@source` at all three story roots. If a story's classes
render unstyled, check `@source` before debugging the component.

### 5.3 Theming

Tokens are demonstrated by the `Foundations/*` pages rather than by wiring
Ladle's `d` theme toggle into a live re-theme. The seam, if wanted, is
`globalState.theme` in the provider.

### 5.4 Addons

Only `a11y` (axe) is turned on — it is off by default, and a styleguide is where
per-component accessibility feedback belongs. The rest stay at Ladle's defaults.

### 5.5 Shell relayout

`appendToHead` in `config.mjs` makes story content always full-width: the nav
(`.ladle-aside`) becomes a right-edge overlay toggled by a fixed hamburger
button appended to `<body>` outside Ladle's React root, with the open state as a
class on `<html>`. Escape closes it; `/` opens it before focusing search.
Desktop only (≥768px). This targets Ladle's **internal shell classes**
(`.ladle-aside`, `.ladle-main`, `.ladle-addons`), which are not a public API —
re-verify them on any Ladle upgrade (§9).

### 5.6 The size ladder — FULL / COMPACT / MINI

One size vocabulary for the whole system, defined in
[`src/styles/sizing.ts`](../../packages/component-lib/src/styles/sizing.ts) and
rendered from those constants on `Foundations/Sizing`. Rungs are named by intent:

| Rung        | It is               | Use it for                                                        |
| ----------- | ------------------- | ----------------------------------------------------------------- |
| **Full**    | the reading size    | a surface the user looks _at_ — a sheet header, a primary action  |
| **Compact** | **the default**     | a surface scanned _past_ — a listing row, a secondary control     |
| **Mini**    | the annotation size | attached to another element — a count, a tech-level tag, a stamp  |

- `compact` is the default on every axis.
- A component offers only the rungs it genuinely has, named from this list.
- Label and body sizes are separate (`RUNG_TYPE` defines `{ label, body }`).
- Compose from `RUNG_TYPE` / `RUNG_INLINE_PADDING`, never restate the values;
  `Badge`'s `STAMP_SIZE` is the reference implementation.

## 6. Writing a story

- `import type { Story } from` the harness (`src/stories/_harness.tsx`); each named export is a plain function component typed
  `Story`. The default export is the meta object, in practice just `title`, and
  it must be a **static literal** — Ladle analyses it statically.
- **Groups, top to bottom:** Foundations (tokens, layout, the QA harness) ·
  Atoms (single presentational job, no Salvage Union knowledge) · Containers
  (content-agnostic wrappers) · Compositions (domain components). These are
  membership tests, not rosters; the catalog itself is the roster.
- **Only Compositions has sub-groups** — Entity, Catalog, Dashboard, Wizard,
  Shell — and a cluster earns one at 3+ siblings. Adding one means editing both
  `SUBGROUPS` in the guard and `storyOrder` in `config.mjs`.
- **No args / argTypes / controls.** Stories are curated galleries of real
  states; interactivity is `useState` inside the story, which exercises the path
  an app actually produces.
- **Real data, through the real components.** A generic container (`Card`) may
  use abstract content, with a comment saying so.
- Import `Caption` and friends from `src/stories/_harness.tsx` (apps:
  `component-lib/stories/harness`); do not re-declare them.
- Lay a component's states out **side by side**, one captioned cluster each, so
  drift is visible at a glance. A single show-everything page is exported as
  `Default`; story ids are effectively URLs, so do not churn export names.

## 7. Coverage is enforced

`src/story-coverage.test.ts` fails unless every barrel-exported visual component
is imported by a story **in its own directory** — a name merely mentioned in some
gallery does not count, because it gets no sidebar entry. It also fails on: a
title outside the four groups or sanctioned sub-groups, nesting deeper than
`Group/Sub-group/Leaf`, duplicate titles, a component story in `src/stories/`,
a story that imports nothing from its own directory, a title that does not name
its component, and stale `ALLOWLIST` / `PROTOTYPE_STORIES` entries (both empty,
which is the steady state). App stories are held to every rule except coverage.

## 8. Troubleshooting

| Symptom                                   | Likely cause                                     | Fix                        |
| ----------------------------------------- | ------------------------------------------------ | -------------------------- |
| Every story blank, no error               | a second React plugin in `vite.config.ts`        | §5.1                       |
| One story blank / "Schema not loaded"     | data read that bypasses the preload gate         | §4                         |
| Classes render unstyled                   | `@source` in `ladle.css` does not reach the file | §5.2                       |
| Sidebar order looks random                | `storyOrder` uses an outer-scope helper          | §3                         |
| Coverage failure on a new component       | no co-located story                              | add `<Component>.stories.tsx` |
| `tsc` errors inside Ladle's own source    | something imports `@ladle/react`                 | §9                         |

## 9. Why nothing imports `@ladle/react`

- **`@ladle/react` is pinned to 5.1.1.** Its type entry pulls in Ladle's own UI
  source (`typings-for-build/app/src/ui.tsx`), so any import puts that file
  under `tsc`, and TypeScript 7 reports JSX errors there that Ladle's
  `@ts-ignore` lines no longer suppress.
- So stories take `Story` from `src/stories/_harness.tsx`, `.ladle/components.tsx`
  types its provider props itself, and Biome's `noRestrictedImports` rejects
  the import in component-lib.
- **To bump Ladle:** run `ladle:build`, confirm no story renders blank (§5.1,
  §4), and re-verify the shell relayout selectors (§5.5).

## 10. Checklist — adding or refreshing a component

- [ ] Exported from `src/index.ts` if public.
- [ ] Its own co-located `<Component>.stories.tsx`, not a second component in a
      sibling's file.
- [ ] Title in a sanctioned group / sub-group, unique; exports typed `Story`.
- [ ] Real SRD data through the real components; no outer `bg-paper`.
- [ ] `bun --filter component-lib test` and `ladle:build` pass.
