# Ladle as a Styleguide — Best-Practices Reference

How this monorepo uses [Ladle](https://ladle.dev) as the single, authoritative styleguide for
its design system, plus the general Ladle best practices that decision rests on. Read this
alongside [`canonical-primitive-language.md`](./canonical-primitive-language.md) (the token/primitive
vocabulary the catalog demonstrates) and [`packages/component-lib/CLAUDE.md`](../../packages/component-lib/CLAUDE.md)
(the load-bearing, enforced story conventions — this doc explains and expands them, it does not
override them).

> **TL;DR for contributors.** There is exactly one Ladle catalog, in `packages/component-lib`.
> Run it with `bun run ladle` from the repo root. Every public visual component must have a
> `*.stories.tsx` beside it (a test enforces this). Stories are plain function components typed
> `Story`, exported from a file with `export default { title: 'Group/Title Case' }`, driven by
> **real SRD data**, grouped Foundations → Atoms → Containers → Compositions. We do not
> use args/argTypes/controls/decorators/MSW — interactivity is plain `useState`. Don't change the
> pinned `@ladle/react@5.1.1` or its patch without reading §9.

---

## 1. What Ladle is, and why we chose it

Ladle is a drop-in alternative to Storybook: an isolated, browser-based development environment that
auto-discovers "stories" (small example renderings of a component) and presents them in a navigable
catalog. Its distinguishing properties, all of which we rely on:

- **Vite-native, no bundling step.** It serves modules straight to the browser, so the dev server
  starts instantly and hot-reloads via React Fast Refresh. This matters because `component-lib`
  itself has **no build step** ([ADR-011](../adrs/ADR-011-component-lib-source-no-build.md)) — Ladle
  consumes the same TypeScript source the apps do, with no separate compile.
- **Tiny production build.** `ladle build` emits a static, code-split site (Ladle's own docs cite
  ~250KB of assets vs. Storybook's ~5MB). Stories are code-split by default, so catalog size scales
  with no load-time penalty.
- **No iframes, single app.** The whole catalog is one SPA; addon state is persisted in the URL, so
  any story-with-settings is a shareable link.
- **A static `meta.json` index.** Every story and its metadata is exported as JSON, which is the hook
  our visual-regression story (see §8) uses to auto-generate one screenshot test per story.

Why this makes a good **styleguide** (not just a dev sandbox): a styleguide's job is to be the single
place where every shipped UI primitive is shown, in its real states, with the real design tokens, so
that (a) contributors discover what already exists before building a one-off, and (b) visual drift is
caught. Ladle gives us that for free _if_ we hold two disciplines: **every public component appears**
(coverage guard, §7) and **every story shows production-real content** (real-data rule, §6).

---

## 2. Where Ladle lives in this repo

**One catalog, in `packages/component-lib`.** The apps (`srd`, `itun`, `discord-bot`,
`su-assets`) have no Ladle config, no `@ladle/react` dependency, and no `ladle` script of their own.
The shared component library is the design system, so it is the only thing with a styleguide.

```
packages/component-lib/
  .ladle/
    config.mjs         # catalog config: stories glob, output dir, vite pointer, sidebar order
    components.tsx      # the single GlobalProvider: paper canvas + data preload gate
  vite.config.ts        # consumed ONLY by Ladle (via config.mjs `viteConfig`)
  src/
    styles/ladle.css    # Tailwind + theme entry imported by the provider
    stories/            # CATALOG PAGES ONLY — flat, no subdirectories
      _harness.tsx      # shared caption/frame helpers (import, don't re-declare)
      Styleguide.stories.tsx      # the orientation front door (defaultStory)
      Theme.stories.tsx           # \
      Typography.stories.tsx      #  | token specimens, generated FROM the tokens
      Layout.stories.tsx          # /
      RenderingMatrix.stories.tsx # the QA harness
    **/<Component>.stories.tsx   # component stories, CO-LOCATED beside their component
    story-coverage.test.ts       # the enforcement guard (see §7)
```

**The one-line standard: ONE public component = ONE co-located story file = ONE nav leaf**, titled
`Group[/Sub-group]/Component Title Case`. `src/stories/` holds only the five catalog pages above —
pages that document the system itself and have no backing component. Everything else lives beside the
component it demonstrates, and the guard (§7) fails CI on either violation.

**Commands** (run from the repo root):

| Command                                         | What it does                                                |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `bun run ladle`                                 | `bun --filter component-lib ladle serve` — dev catalog, HMR |
| `bun --filter component-lib ladle:build`        | static build into `build-ladle/`                            |
| `bun --filter component-lib exec ladle preview` | serve a built catalog (used for the VR harness)             |

> Note: root `package.json` also defines `ladle:web` and `ladle:itun`, but those apps define no
> `ladle` script, so those two aliases are inert. Only `bun run ladle` (→ component-lib) works. This
> is intentional — the catalog is centralized, not per-app.

---

## 3. Configuration reference (`config.mjs`)

Ladle's config is a plain default-exported object in `.ladle/config.mjs`, shared by the CLI and the
browser. Type it with the JSDoc pragma `/** @type {import('@ladle/react').UserConfig} */` for
editor help. Our full config today:

```js
export default {
  stories: 'src/**/*.stories.{ts,tsx}',
  outDir: 'build-ladle',
  viteConfig: './vite.config.ts',
  // Open on the orientation page instead of whatever sorts first.
  defaultStory: 'foundations--styleguide--overview',
  // Per-component accessibility checks (axe). Off by default in Ladle.
  addons: {
    a11y: { enabled: true },
  },
  storyOrder: (stories) => {
    const groups = ['foundations', 'atoms', 'containers', 'compositions']
    const subgroups = {
      compositions: ['entity', 'catalog', 'dashboard', 'wizard', 'shell'],
    }
    const rank = (id) => {
      let g = groups.findIndex((name) => id.startsWith(`${name}--`))
      if (g === -1) g = groups.length
      const group = groups[g]
      const subs = (group && subgroups[group]) || []
      // Ungrouped leaves sort after the group's sub-grouped clusters.
      let s = subs.findIndex((name) => id.startsWith(`${group}--${name}--`))
      if (s === -1) s = subs.length
      return [g, s]
    }
    return [...stories].sort((a, b) => {
      const ra = rank(a)
      const rb = rank(b)
      return ra[0] - rb[0] || ra[1] - rb[1] || a.localeCompare(b)
    })
  },
}
```

The story-id format `defaultStory` targets joins every title segment and the export name with
`--`: `Foundations/Styleguide` + `Overview` → `foundations--styleguide--overview`.

### 3.1 Every config option (with Ladle's defaults)

| Option                 | Default                                | Notes / our value                                                                                                                                                                                                                                            |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stories`              | `src/**/*.stories.{js,jsx,ts,tsx,mdx}` | We narrow to `src/**/*.stories.{ts,tsx}` (TS only, no MDX).                                                                                                                                                                                                  |
| `defaultStory`         | `""`                                   | Story key to open on load. We open on `foundations--styleguide--overview` (the orientation page).                                                                                                                                                            |
| `storyOrder`           | identity `(s) => s`                    | A function or array (supports `["folder*"]` wildcards). We sort by the four-group taxonomy — see §6.2.                                                                                                                                                       |
| `viteConfig`           | `undefined`                            | Path to a Vite config Ladle should merge. We point at `./vite.config.ts` (Tailwind only — see §5.1).                                                                                                                                                         |
| `outDir`               | `build`                                | We use `build-ladle`.                                                                                                                                                                                                                                        |
| `base`                 | `undefined`                            | Base path for sub-path deploys (e.g. GitHub Pages).                                                                                                                                                                                                          |
| `port` / `previewPort` | `61000` / `8080`                       | Dev / preview server ports. `61000` is the URL the VR harness hits.                                                                                                                                                                                          |
| `host` / `previewHost` | —                                      | Bind host for dev / preview.                                                                                                                                                                                                                                 |
| `hmrHost` / `hmrPort`  | `undefined`                            | HMR overrides (rarely needed).                                                                                                                                                                                                                               |
| `mode`                 | Vite mode                              | Affects `.env` loading.                                                                                                                                                                                                                                      |
| `appendToHead`         | `""`                                   | Inject raw CSS/HTML into Ladle's own shell `<head>`. We use it for the **shell relayout** (§5.5) — a `<style>` block that docks the nav as a right-edge auto-hiding sidebar (slides open leftward). Story-content CSS still comes through the provider (§5). |
| `expandStoryTree`      | `false`                                | Auto-expand the whole sidebar on load.                                                                                                                                                                                                                       |
| `noWatch`              | `false`                                | Disable file watching.                                                                                                                                                                                                                                       |
| `disableHttp2`         | `false`                                | —                                                                                                                                                                                                                                                            |
| `hotkeys`              | see below                              | Per-action key arrays.                                                                                                                                                                                                                                       |
| `i18n`                 | one tooltip string                     | UI copy overrides.                                                                                                                                                                                                                                           |
| `onDevServerStart`     | no-op                                  | Hook fired when the dev server boots.                                                                                                                                                                                                                        |
| `addons`               | see §5.4                               | Per-addon `{ enabled, defaultState, … }`. We enable `a11y` (axe).                                                                                                                                                                                            |

Default hotkeys (override individually via `hotkeys: { … }`):

```js
{
  search: ['/', 'meta+p'],   nextStory: ['alt+arrowright'], previousStory: ['alt+arrowleft'],
  nextComponent: ['alt+arrowdown'], previousComponent: ['alt+arrowup'],
  control: ['c'], darkMode: ['d'], fullscreen: ['f'], width: ['w'],
  rtl: ['r'], source: ['s'], a11y: ['a'],
}
```

(`meta` = Cmd/Win, `alt` = Option.)

### 3.2 The three `.ladle/` files, and which runtime sees each

Ladle splits config across files by **where the code runs** — get this wrong and you get cryptic
crashes or blank stories:

- **`config.mjs`** — evaluated in **both** the Node CLI and the browser. Keep it serializable-ish.
  The `storyOrder` function in particular is **serialized and re-evaluated in the browser without its
  module scope** — so it must be fully self-contained (no imports, no outer-scope helpers). Our config
  carries a comment saying exactly this; honor it.
- **`components.tsx`** — **browser-only**. This is where React lives: the `GlobalProvider`, global CSS
  imports, context providers, data preload. See §4.
- **`head.html`** — raw HTML injected into `<head>`. We don't use the file form; the shell relayout
  (§5.5) goes through `appendToHead` in `config.mjs` instead (the programmatic equivalent, kept beside
  the rest of the config), and story-content styling flows through the provider's CSS import.

---

## 4. The GlobalProvider — one canvas, one data gate

`.ladle/components.tsx` exports a single `Provider` of type `GlobalProvider`. This wraps **every**
story, and is where cross-cutting concerns belong so no individual story has to repeat them.

Our provider does two jobs:

```tsx
import type { GlobalProvider } from '@ladle/react'
import { Suspense, use, type ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import '../src/styles/ladle.css'

let preloadPromise: Promise<void> | null = null
function getPreloadPromise() {
  if (!preloadPromise) preloadPromise = SalvageUnionReference.preload('all')
  return preloadPromise
}
function PreloadGate({ children }: { children: ReactNode }) {
  use(getPreloadPromise()) // suspends until game data is loaded
  return <>{children}</>
}

export const Provider: GlobalProvider = ({ children }) => (
  <div
    className="min-h-screen bg-paper"
    style={{ padding: '1rem', fontFamily: 'Fira Code, monospace' }}
  >
    <Suspense fallback={null}>
      <PreloadGate>{children}</PreloadGate>
    </Suspense>
  </div>
)
```

1. **Global paper canvas.** Every story renders on `bg-paper` with mono font + padding, matching how
   the apps present these components. Because the canvas is global, **a story must not add its own
   outer `bg-paper` wrapper.**
2. **Data preload gate.** Our stories read `SalvageUnionReference.*` fixtures at module top level, which
   executes the instant Ladle dynamically imports the story's chunk. Without a gate ahead of that
   import, every model access throws _"Schema not loaded"_ and the story renders **silently blank —
   not an error page**. The `use()` + `Suspense` gate mirrors ITUN's `GameDataReady` and srd's
   `useGameData`. This is the single most important repo-specific detail: **new stories must stay
   consistent with this pattern** (don't fetch data a different way, don't bypass the gate).

### 4.1 What the provider gives you (Ladle's `GlobalProvider` contract)

The provider receives `{ children, globalState, storyMeta, config }`:

- `globalState` — live addon state: `globalState.theme` (`"light"`/`"dark"`), `globalState.rtl`,
  `globalState.width`, `globalState.control` (current control values), `globalState.mode`, etc.
  This is how you make the provider react to the theme/RTL toggles (e.g. feeding a theme into a
  CSS-in-JS provider). We don't currently branch on it, but it's the hook if we add a real
  dark-theme demo.
- `storyMeta` — the `meta` object for the current story (see §8.1).
- `config` — the resolved Ladle config.

### 4.2 Decorators (the per-story / per-file equivalent)

We deliberately use **zero decorators** today — the one global provider covers every need. For
completeness, Ladle supports two narrower scopes when a _subset_ of stories needs extra wrapping:

```tsx
// per story
MyStory.decorators = [
  (C) => (
    <div style={{ margin: '3em' }}>
      <C />
    </div>
  ),
]
// per file (all stories in the file), via the default export
export default {
  decorators: [
    (C) => (
      <Frame>
        <C />
      </Frame>
    ),
  ],
} satisfies StoryDefault
```

Decorators receive `(Component, context)` where `context.globalState` is the same live state as
above. Reach for a file-level decorator only when a whole family genuinely needs a wrapper the global
canvas can't give (e.g. a router context for one composition) — prefer the shared `_harness.tsx`
helpers for anything presentational.

---

## 5. Styling, Tailwind, and theming

### 5.1 The Vite config is Tailwind-only (and must stay that way)

`vite.config.ts` is consumed only by Ladle (via `config.mjs`'s `viteConfig`). It adds exactly one
plugin:

```ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ plugins: [tailwindcss()] })
```

**Do not add `@vitejs/plugin-react` here.** Ladle registers its own React plugin; a second one crashes
every transform with `Missing field 'moduleType'` and every story renders blank. Tailwind is the only
plugin Ladle doesn't already provide, so it's the only thing this file should contain.

### 5.2 Global CSS entry

Global styles reach the catalog through the provider's single import of `src/styles/ladle.css`:

```css
@layer reset;
@import 'tailwindcss';
@import './theme.css';
@source '..'; /* scan the whole package src for Tailwind classes */
```

The `@source '..'` line is what makes Tailwind v4 pick up utility classes used anywhere in the
package — the analog of the apps' `@source` paths. If a story's classes render unstyled, check this
`@source` scope **before** debugging the component (per the repo's "styling bugs → Tailwind config
first" rule).

### 5.3 Theming

Ladle ships a light/dark **theme addon** whose state lives at `globalState.theme` and is toggled with
`d`. Our catalog renders on the paper canvas and demonstrates tokens via a dedicated
`Foundations/Theme` story rather than wiring the toggle into a live re-theme. If we later want the
`d` toggle to actually re-theme components, the mechanism is: read `globalState.theme` in the
provider and set the corresponding token attribute/class on the canvas wrapper. (Ladle also supports
`emotion`/`styled-components` via SWC plugins and CSS-in-JS providers keyed on `globalState.theme` —
not relevant to our Tailwind setup, but that's the seam if it ever is.)

### 5.4 Addons

Ladle's built-in addons appear as buttons in the bottom-left and persist their state in the URL.
Each is configured under `addons` in `config.mjs` as `{ enabled, defaultState, … }`. The full set and
their `config.mjs` defaults:

| Addon     | Default              | Hotkey | What it does                                                                                             |
| --------- | -------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `control` | `enabled`            | `c`    | Props panel — only appears if a story defines `args`/`argTypes`. We define none (§6.3), so it's dormant. |
| `theme`   | `enabled`, `"light"` | `d`    | Light/dark toggle → `globalState.theme` (§5.3).                                                          |
| `mode`    | `enabled`, `"full"`  | `f`    | Full / preview (chrome-less) / fullscreen. `preview` is what the VR harness screenshots (§8).            |
| `width`   | `enabled`            | `w`    | Viewport width presets (xsmall 414 / small 640 / medium 768 / large 1024).                               |
| `rtl`     | `enabled`, `false`   | `r`    | Flips direction → `globalState.rtl`.                                                                     |
| `source`  | `enabled`            | `s`    | View the story's source code.                                                                            |
| `action`  | `enabled`            | —      | Logs `action()` handler calls. We don't use `action()`.                                                  |
| `a11y`    | **off**              | `a`    | axe-core accessibility audit of the rendered story.                                                      |
| `msw`     | off                  | —      | Mock Service Worker request mocking.                                                                     |

**We turn `a11y` on** — it's off by default, and a styleguide is exactly where per-component
accessibility feedback belongs. It adds axe (~590KB) to the dev/preview bundle only; catalog build
time is unaffected (it lazy-loads). Everything else stays at Ladle's defaults.

```js
addons: {
  a11y: { enabled: true },
}
```

### 5.5 Shell relayout — right-edge auto-hiding nav, full-bleed content

Ladle's default shell puts the story-nav sidebar on the left (reserving a fixed column) and the
addon/controls toolbar floating bottom-left. We relayout the shell so the **story content is always
full-width** while keeping a **standard vertical nav** that gets out of the way:

- **Controls stay at the bottom (native).** Ladle already pins the addon toolbar (`.ladle-addons`) to
  `position: fixed; bottom: 0` — no work needed; we only nudge it to the bottom-left.
- **Nav becomes a right-edge auto-hiding sidebar.** A `<style>` block in `appendToHead` (`.ladle/config.mjs`)
  pulls the nav (`.ladle-aside`) out of the flex row (`position: fixed; right/top/bottom: 0`), collapses
  it to a ~3rem right strip, and **slides it open leftward** to `18rem` on `:hover` / `:focus-within`
  — as an **overlay that reserves no layout space**, so `.ladle-main` stays full-width (`width: 100%`,
  with a small `padding-right` to clear the collapsed strip). The story tree stays its normal vertical
  list and scrolls vertically. `:focus-within` keeps the `/` search reveal working; the drag-resize
  handle is hidden. Desktop-only (`min-width: 768px`); Ladle already stacks to a column on mobile.

**This is the officially-blessed route** — Ladle's docs cite `appendToHead` for "repositioning the
sidebar." But it targets Ladle's **internal shell classes** (`.ladle-aside` / `.ladle-main` /
`.ladle-addons`), which are not a public API. They are **load-bearing and pinned to `@ladle/react`
5.1.1** (§9): on any Ladle upgrade, re-verify these selectors still exist and the slide still works.
The inline `min-width` Ladle sets via its resize logic must be beaten with `min-width: 0 !important` —
the recipe already does. (To dock the nav as a bottom bar instead, flip the `.ladle-aside` block to
`left/right/bottom: 0` with a collapsed `height` + `:hover` height.)

---

### 5.6 The size ladder — FULL / COMPACT / MINI

**One size vocabulary for the whole system.** Every three-step size axis uses
these three names. The canonical definition is
[`src/styles/sizing.ts`](../../packages/component-lib/src/styles/sizing.ts); the
specimen page is `Foundations/Sizing`, rendered _from_ those constants so the
catalog cannot drift from the code.

The rungs are defined by **intent**, not by pixel count:

| Rung        | It is               | Use it for                                                                                             |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| **Full**    | The reading size    | A surface the user is looking _at_ — a sheet header, a primary action, the card the page is about      |
| **Compact** | **The default**     | A surface the user is scanning _past_ — a listing row, a section label, a secondary control            |
| **Mini**    | The annotation size | Attached to another element, never read alone — a count, a tech-level tag, a stamp riding a card frame |

Why this replaced `sm | md | lg`: those names described a size **relative to
their own component**, so `sm` on a stamp and `sm` on a button were unrelated
values and neither told you which rung a surface was supposed to occupy. Naming
the rung by its job means a reader can tell, from the prop alone, whether an
element is a destination, a row, or an annotation.

Rules:

- **`compact` is the default on every axis.** It is where most of the system
  sits — the ladder is deliberately not a symmetric three with the middle as a
  neutral midpoint.
- **A component offers only the rungs it genuinely has**, and names them from
  this list. A two-rung component exposing `compact` and `mini` is correct and
  complete; do not invent a `full` that nothing uses.
- **Label size and body size are separate**, because they do not move together:
  a compact row legitimately carries mini labels over body-size text. `RUNG_TYPE`
  therefore defines `{ label, body }` per rung.
- **Compose, never restate.** A component builds its geometry from
  `RUNG_TYPE` / `RUNG_INLINE_PADDING` rather than re-typing the values —
  `Badge`'s `STAMP_SIZE` is the reference implementation. A restated value is a
  future drift.
- Components whose geometry genuinely differs (a button needs a larger tap
  target than a stamp) scale their own padding, but **keep the rung names**, so
  the vocabulary still reads across the system.

**Known exception, not yet reconciled:** `buttonVariants` still exposes a
four-step `xs | sm | md | lg`. Four rungs do not map onto three without losing a
step, so that axis needs a design decision (drop a rung, or bless buttons as a
four-rung exception) before it is renamed.

## 6. Writing a story (the conventions, enforced)

### 6.1 The story module shape

```tsx
import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Stat } from './Stat'

// Ladle wants the file to export story components; the default export carries meta.
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle meta default export
export default { title: 'Atoms/Stat' }

const chassis = SalvageUnionReference.Chassis.all()[0]   // REAL data, module top level

export const Anatomies: Story = () => (
  <Stat label="Structure Pts" value={chassis.structurePts} />
)

export const States: Story = () => ( /* … damaged, disabled, empty … */ )
```

Rules that hold here:

- **`import type { Story }`** and type every named export `Story`. Stories are **plain function
  components** (`() => JSX`) — see §6.3 for why we don't use the args API.
- **Default export = meta object.** In practice we set only `title`. It must be a **static literal**
  — `title`, `storyName`, and `meta` are statically analyzed and _cannot_ be built from variables or
  concatenation. `StoryDefault`/`Story` are the exported types; a plain object with the biome-ignore
  comment is our house style.
- **`title` is `Group[/Sub-group]/Title Case With Spaces`** and matches the component's display name:
  `Atoms/Stat`, `Containers/Display Card`, `Compositions/Dashboard/Grid`. Ladle turns `/` into sidebar
  nesting and title-cases/space-splits segment names automatically. Titles must be **unique** across
  files — two files claiming one title silently collapse the nav.
- **The file keeps the component symbol name** — `Stat.stories.tsx` — so a symbol grep still finds
  it, even though the sidebar label comes from `title`. Where a file defines several exports (e.g.
  `SmallButtons.tsx` → `StepButton`), the story keeps the **defining file's** basename so it stays
  visibly co-located.
- **Co-locate** the story beside its component. Only the five catalog pages live in `src/stories/` (§2).
- **One component per story file — no galleries.** A file that renders several sibling primitives
  gives all but one of them **no sidebar entry at all**: they are undiscoverable in the catalog while
  still looking "covered". This is the precise failure a styleguide exists to prevent, so the guard
  now requires each component to be imported by a story in **its own directory** (§7).
- **A catch-all "show everything" story is exported as `Default`** (not `Variants`/`Costs`/etc.).
- **Rename an individual story** (rarely needed) with `Story.storyName = 'Renamed'` — also a static
  literal.

### 6.2 The four groups (sidebar order, top-to-bottom)

`storyOrder` sorts the sidebar into a deliberate reading order that encodes composition level (simple →
complex, read top-to-bottom):

1. **Foundations** — design tokens + layout scaffolding + the QA harness. No product component
   (`Theme`, `Typography`, `Layout`, the `Rendering Matrix`). Foundation specimens are generated
   **from the tokens** (`Typography` iterates the `--text-*` / `--font-*` / `--tracking-*` scales so
   it can't drift from `theme.css`).
2. **Atoms** — primitives with a single presentational job and **no Salvage Union domain knowledge**
   (e.g. `Text`, `Slab`, `Badge`, `Button`, `Stat`). An atom **may** compose a lower-level atom —
   `Stat` composes `Text` + `Tooltip`, `CountStepper` composes `StepButton`. Domain knowledge, not
   composition, is the line between an atom and a composition.
3. **Containers** — content-agnostic wrappers / state shells that would still make sense with entirely
   different content inside (e.g. `Display Card`, `Modal`, `Inset`, `Toast`).
4. **Compositions** — domain/game components: they know about Salvage Union entities, or they assemble
   atoms into a product surface (e.g. the Reference Entity family, Roll Table, `Dashboard/*`).

These are **membership tests, not rosters.** The examples are illustrative; for the current members read
the catalog itself (`bun run ladle`), which the coverage guard (§7) proves is complete. Deliberately no
list lives here or in `component-lib/CLAUDE.md` — a hand-maintained roster is a second source of truth
that silently drifts every time a component lands, which is exactly what happened to the previous
version of this section. The definitive _definitions_ live in `component-lib/CLAUDE.md`.

(There is no `Legacy` tier — every component lives in its real group. Note the style-unification refresh
itself is still in progress on the 466 branch, so a group's membership is expected to change as
primitives are fused.)

#### Sub-groups (sanctioned, never ad-hoc)

`Compositions` is the only group large enough to earn a second level. Its sanctioned sub-groups, in
sidebar order, are:

| Sub-group                | Holds                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Compositions/Entity`    | the Reference Entity family — Card, Actions, Content, Class Ability Tree, Choice Groups, Entity Tooltip, Static Entity Content, Catalog Choice Modal |
| `Compositions/Catalog`   | browse/lookup surfaces — Entity Grid, Entity Row, Entity Searcher, Roll Table                                                                        |
| `Compositions/Dashboard` | the dark-instrument Dashboard surface (Gauge, Grid, Dial, Rail Bar, …)                                                                               |
| `Compositions/Wizard`    | build-flow surfaces — Wiz Shell, Mech Install Step, New Entity Screen                                                                                |
| `Compositions/Shell`     | app chrome — App Bar, Footer, Nav Drawer                                                                                                             |

Three rules keep this from decaying into a folder pile:

1. **A cluster earns a sub-group at 3+ siblings.** Below that it stays a direct leaf of its group —
   which is why `Live Sheet`, `Rule Brief`, `Off Rules Escape` and `Changelog View` sit at
   `Compositions/*` with no sub-group. Sub-groups sort **ahead of** their group's ungrouped leaves.
2. **Atoms and Containers stay flat, on purpose.** They are lists of peers; a flat list is scannable
   and keeps `/` search a single hop. Splitting them would mean inventing category lines
   (Typography / Controls / Indicators) that are arguable rather than structural.
3. **Nesting never exceeds `Group/Sub-group/Leaf`.** Three segments is the hard ceiling.

Adding a sub-group means editing **both** `SUBGROUPS` in `src/story-coverage.test.ts` **and**
`storyOrder` in `.ladle/config.mjs` — the guard fails on any sub-group not in that list.

### 6.3 Why we don't use args / argTypes / controls

Ladle has a full **Controls** system: put `Story.args = { label: 'Hi', disabled: false }` and
`Story.argTypes = { variant: { options: [...], control: { type: 'radio' } } }` on a story and Ladle
auto-generates an interactive props panel (text/boolean/number/range/radio/select/multiselect/color
inputs, plus `action` loggers). Controls cascade global → file → story.

**We intentionally don't use them.** Our stories are curated _galleries_ of real, production-shaped
states driven by real SRD data, not a knobs-panel for one component instance. When a story needs
interactivity (a stepper, a toggle demo), we use **plain React `useState` inside the story component**
— it exercises the exact code path an app produces, with real data, and doesn't invite fake prop
combinations. This is a deliberate philosophy choice, not a limitation:

- Controls are best when a component's surface is a bag of primitive props and you want to fuzz them.
- Our components render **game entities**; the meaningful "variants" are real entities and real states,
  which a gallery shows better than a knob ever could.

If you're tempted to add `args`/`argTypes`, first ask whether a second real-data example would show the
case better. Usually it does. (This keeps us aligned with the real-data rule below.)

### 6.4 The real-data rule (non-negotiable)

- **Every story renders real SRD data or real game terms — never lorem / placeholder / invented
  content.** Drive props from `SalvageUnionReference.*` fixtures; when a prop needs a literal (a label,
  a stat name, a condition), use the real game term.
- **Render entities the way apps actually render them.** Feed props in the real shapes through the real
  components (entities via `ReferenceEntityDisplay`, stats via `Stat`). Don't hand-assemble simplified
  markup no app produces — the story must exercise the same path production does.
- Rationale: a story is a preview of what ships. Fake data hides the rendering bugs (overflow, wrapping,
  tone, empty-state) that only surface with production content — which is exactly what a styleguide
  exists to catch.
- **The one sanctioned exception:** a genuinely generic container primitive (e.g. `DisplayCard`) may use
  abstract content, because it _is_ content-agnostic. When you do this, say so in a comment (as
  `DisplayCard.stories.tsx` does).

### 6.5 Shared helpers, not copy-paste

Caption/frame helpers that would otherwise be duplicated across story files live in
`src/stories/_harness.tsx` (e.g. `Caption`). Import them; don't re-declare a local copy. Lead each
gallery section with a one-line prose statement of the rule it demonstrates (existing stories do this
— it turns the catalog into documentation, not just a grid).

---

### 6.6 Lay out for comparison, not just display

A styleguide earns its keep when drift is **catchable at a glance**, so a component's primary story is a
**captioned side-by-side gallery** of its real states, not a single lonely instance:

- **Show every meaningful state on one canvas**, laid out for the eye to compare — a variant grid (every
  size/tone as captioned cells), a state matrix (rows = variant × columns = state: default / disabled /
  loading / damaged / empty), or a compact-vs-expanded / before-after pair. Side-by-side is the only
  layout where mismatched spacing, weight, or tone jumps out.
- **Caption each cluster** with one line (what it is + when to use it) via the shared `Caption` helper —
  that is what turns a grid of unlabeled boxes into documentation.
- **Keep the export named `Default`** when a file has a single show-everything page (§6.1). We adopt the
  _content_ practice of a side-by-side "overview" gallery, but not a rename — story ids are effectively a
  public URL (deep links, the `defaultStory` front door), so we don't churn export names.
- **Reserve live `useState` for behavior.** When the point is an interaction (a stepper increments, an
  inline-edit commits, a modal opens), a real `useState` demo beats a static grid — and beats a
  knobs/controls panel, which we don't use (§6.3).

## 7. Coverage is enforced — stories are part of the contract

`src/story-coverage.test.ts` (a `bun:test`) is the executable half of the standard. It fails CI unless
**every barrel-exported (`src/index.ts`) visual component is imported by a story file in its own
directory**. Practical consequences:

- **Adding a public component ⇒ add its story in the same change.** No "I'll story it later."
- The only escape is the test's `ALLOWLIST`, reserved for genuine internal sub-parts demonstrated
  through their parent (each entry needs a one-line rationale). Current entries: `CardHeader`,
  `CardImage`, `ControlButtons`, `ChassisAbilitiesContent`, `SectionSeparator`.
- The guard also fails on **stale** allowlist entries — a name that has since gained its own story, or
  no longer exists. So when you story a previously-allowlisted component (or delete one), prune the
  allowlist in the same change.

**Why a co-located importer, and not a name match.** The guard used to concatenate every story file and
regex-search it for each component's name. That passed whenever a component was so much as _mentioned_
anywhere in the catalog — so a dozen components sat inside multi-component gallery files with **no nav
entry of their own**, indistinguishable from genuinely storied ones. Requiring the importer to live in
the component's **own directory** makes a green guard mean what the catalog implies: this component has
its own page, beside its source.

**Five further assertions guard the taxonomy and layout.** All read **only** the default-export meta
title (the first `title:` after `export default`), so non-meta `title:` occurrences in story bodies —
entity names like `'Cargo Hold'`, a `title:` prop, a code-sample string — are correctly ignored.

| Assertion                 | Fails when                                                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sanctioned group          | a title doesn't start `Foundations/`, `Atoms/`, `Containers/` or `Compositions/`                                                                                                                                |
| sanctioned sub-group      | a title uses a second segment not in `SUBGROUPS`, or nests deeper than `Group/Sub-group/Leaf`                                                                                                                   |
| unique titles             | two story files claim the same title (silently collapses the nav)                                                                                                                                               |
| co-location               | a `*.stories.tsx` sits in `src/stories/` without being one of the five catalog pages                                                                                                                            |
| catalog pages are tokens  | a page in `src/stories/` isn't a `Foundations/*` story                                                                                                                                                          |
| no orphan stories         | a story imports no component defined in **its own directory** (a screen mock-up dropped into an unrelated folder) and isn't a listed prototype                                                                  |
| prototype list is fresh   | a `PROTOTYPE_STORIES` entry no longer exists                                                                                                                                                                    |
| title names its component | a title's last segment is neither the story's own basename nor a component defined in its directory. A sub-group may absorb a shared prefix, so `Compositions/Dashboard/Gauge` correctly names `DashboardGauge` |

**The one bounded exception — `PROTOTYPE_STORIES`.** Two stories are frozen **"before" captures** from
the style-unification refresh (`Compositions/Wizard/Mech Install Step`, `.../New Entity Screen`). Each
reproduces an ITUN wizard surface inline — app components cannot be imported cross-package — so the
refreshed primitives can be compared against the legacy appearance they replace. They originate from
`test(component-lib): Legacy "before" captures for dashboard + wizard surfaces`, and a sibling pass has
already deleted 16 comparison-only captures, keeping these two as the app-surface ones.

Because they have no backing component, they are named explicitly in the guard rather than letting "a
story with no component" become an unexamined norm: a new componentless story fails CI until someone
justifies adding it to that list. They live in `src/components/wizard/` — a home named for what they
are, not filed beside an unrelated primitive.

**Do not "fix" them.** They are deliberately frozen and do **not** track the ITUN components they
mirror — preserving the "before" state is the entire point. So don't reconcile them against the app,
and don't extract a component out of them; either would defeat the capture. They retire by **deletion**,
once the refresh they document has landed.

Add a new group or sub-group only by extending both the guard's `GROUPS`/`SUBGROUPS` **and** the
`storyOrder` list in `config.mjs` (§3).

This is what makes the catalog _trustworthy as a styleguide_: it is provably complete with respect to
the public API **and** structurally consistent — not "most things, probably."

---

## 8. `meta.json` and visual-regression testing

### 8.1 The story index

`ladle build` (and `ladle serve` at `/meta.json`) emits a static index of every story: its key,
hierarchy, source location, and a per-story `meta` object. You can annotate stories with custom
static metadata for downstream tooling:

```tsx
export default { meta: { browsers: ['chrome'] } } // file-level
export const First: Story = () => <h1>First</h1>
First.meta = { browsers: ['firefox'] } // story-level overrides file-level
```

`meta` must be statically analyzable (same rule as `title`). It surfaces in `meta.json` **and** to the
provider as `storyMeta`, so it can drive both test selection and provider behavior.

### 8.2 Screenshot testing with Playwright

The `meta.json` index is the seam for zero-maintenance visual regression: iterate the index, and make
one screenshot test per story. The canonical shape (from Ladle's docs) is:

```ts
// tests/snapshot.spec.ts
import { test, expect } from '@playwright/test'
import fetch from 'sync-fetch'

const url = 'http://localhost:61000'
const stories = fetch(`${url}/meta.json`).json().stories

Object.keys(stories).forEach((storyKey) => {
  test(`${storyKey} - compare snapshots`, async ({ page }) => {
    await page.goto(`${url}/?story=${storyKey}&mode=preview`)
    await page.waitForSelector('[data-storyloaded]') // stories are code-split & async
    // NOT SUFFICIENT ON ITS OWN HERE — see the warning below. Our provider wraps
    // every story in <Suspense fallback={null}> behind the data preload gate, so
    // at this point the story may still be suspended and the page genuinely empty.
    await page.waitForFunction(() => document.body.querySelectorAll('*').length > 8)
    await expect(page).toHaveScreenshot(`${storyKey}.png`)
  })
})
```

Run order: `ladle build` → `ladle preview -p 61000` → `playwright test`. The first run writes
baselines; later runs diff against them. New stories are automatically covered — which is _why_ the
coverage guard (§7) plus the real-data rule (§6.4) compound into real protection: every public
component, in real states, is screenshot-diffed with no per-component test wiring.

Two load-bearing details:

- **`mode=preview`** strips Ladle's chrome so you screenshot only the story.
- **`[data-storyloaded]`** on `<html>` signals that the async **chunk** has loaded — always wait on it,
  never a fixed timeout.
- **⚠️ `[data-storyloaded]` does NOT mean the data preload gate has resolved.** This doc previously
  claimed it did; that is wrong, and the error is expensive. Our `GlobalProvider` wraps every story in
  `<Suspense fallback={null}>` (§4), so between "chunk loaded" and "data ready" the story renders
  **literally nothing** — and a VR harness that screenshots at `data-storyloaded` captures an empty
  frame and cheerfully writes it as the baseline. Measured on the current catalog: waiting only on
  `data-storyloaded` left **50 of 176 stories (28%) blank**; adding a wait for committed content
  dropped that to 10, all of which are genuinely minimal stories (`Empty State`, `Banner/Empty`,
  `Changelog/Empty`) or a text-free SVG (`Glyph/Accessible`). Wait for real content — a node-count
  threshold, or a selector you know the story renders — before screenshotting.

> We do not currently commit a Playwright VR suite; this section documents the sanctioned path if/when
> we add one. The catalog is already shaped for it (preload gate renders content headlessly; the VR
> harness relies on that — see the provider comment).

---

## 9. Pinning & the load-bearing patch (do not casually change)

Ladle is pinned and patched. This is deliberate and called out as load-bearing in the design-system
docs — treat it as such.

- **Pinned to `@ladle/react@5.1.1`** via root `package.json` `patchedDependencies`
  (`@ladle/react@5.1.1` → `patches/@ladle%2Freact@5.1.1.patch`). `component-lib` declares `^5.1.1`,
  but the patch pins the resolved version, so a `bun install` that bumps it will break the patch.
- **The patch adds one line** — `// @ts-nocheck` — to Ladle's vendored build artifact
  `typings-for-build/app/src/ui.tsx`. The TypeScript 7 (`tsgo`) upgrade changed JSX error attribution
  so Ladle's existing `@ts-ignore` lines no longer suppress errors in that vendored file. We only
  consume the `Story`/`GlobalProvider` types from the package barrel, so `@ts-nocheck` on the vendored
  UI is safe.
- This sits alongside srd's pinned TS6 foothold as a load-bearing consequence of the TS7 migration
  (see the repo memory _ts7-upgrade-ts6-footholds_ and
  [`canonical-primitive-language.md`](./canonical-primitive-language.md)). A `tools/check-bun-version.ts`
  guard runs in `validate:all` near this discipline.

**If you bump Ladle:** re-verify the patch still applies (or regenerate it), re-run `ladle build`,
confirm no story renders blank (the two classic blank-story causes are the double React plugin, §5.1,
and a broken preload gate, §4), **and re-verify the shell relayout** (§5.5) — its `appendToHead` CSS
targets Ladle's internal shell classes (`.ladle-aside` / `.ladle-main` / `.ladle-addons`), which are not
a public API and could be renamed in a Ladle major.

---

## 10. Troubleshooting — the repo's specific failure modes

| Symptom                                               | Likely cause                                                                     | Fix                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Every story renders blank, no error**               | Second `@vitejs/plugin-react` in `vite.config.ts` (`Missing field 'moduleType'`) | Keep Vite config Tailwind-only (§5.1).                                                          |
| **One story blank / "Schema not loaded"**             | Story reads `SalvageUnionReference.*` but bypasses the preload gate              | Follow the provider's `use()`+`Suspense` pattern; don't fetch data another way (§4).            |
| **Classes render unstyled**                           | Tailwind `@source` scope in `ladle.css` doesn't reach the file                   | Check `@source '..'` before debugging the component (§5.2).                                     |
| **Sidebar order looks random**                        | Edited `storyOrder` to reference an outer-scope helper                           | `storyOrder` is serialized without module scope — keep it self-contained (§3.2).                |
| **New component fails CI with a coverage error**      | No story for a barrel-exported component                                         | Add `<Component>.stories.tsx`; or, if it's a genuine sub-part, allowlist with a rationale (§7). |
| **`ladle build` type-errors in vendored Ladle files** | Patch not applied (version drifted)                                              | Re-pin to `5.1.1` / regenerate the patch (§9).                                                  |
| **Story shows fine but breaks in the app**            | Story used fake/simplified data                                                  | Drive from real `SalvageUnionReference.*` fixtures through the real components (§6.4).          |

---

## 11. Checklist — adding or refreshing a component

- [ ] Component added to `src/index.ts` barrel (if public).
- [ ] `<Component>.stories.tsx` co-located beside it — **its own file**, not appended to a sibling's
      story as a second component (that would leave it with no sidebar entry).
- [ ] `export default { title: 'Group[/Sub-group]/Title Case' }`, group correct per §6.2 (one of
      Foundations / Atoms / Containers / Compositions), sub-group from the sanctioned list, title
      unique across files.
- [ ] Named exports typed `Story`; catch-all page named `Default`.
- [ ] Every example driven by **real SRD data** through the **real components** (§6.4).
- [ ] No outer `bg-paper` wrapper (the global canvas supplies it).
- [ ] Interactivity via `useState`, not args/controls (§6.3).
- [ ] Shared caption/frame helpers imported from `_harness.tsx`, not re-declared.
- [ ] `bun run ladle` renders it correctly; no blank stories.
- [ ] `bun --filter component-lib test` passes (coverage guard green; allowlist pruned if relevant).
- [ ] `bun --filter component-lib ladle:build` succeeds (proves the static styleguide builds).

---

## 12. Sources

Official Ladle documentation (ladle.dev): [Introduction](https://ladle.dev/docs/),
[Setup](https://ladle.dev/docs/setup), [Stories](https://ladle.dev/docs/stories),
[Decorators](https://ladle.dev/docs/decorators), [Controls](https://ladle.dev/docs/controls),
[Config](https://ladle.dev/docs/config), [CSS](https://ladle.dev/docs/css),
[Addons](https://ladle.dev/docs/addons), [Providers](https://ladle.dev/docs/providers),
[Meta](https://ladle.dev/docs/meta), [Visual Snapshots](https://ladle.dev/docs/visual-snapshots/),
[a11y](https://ladle.dev/docs/a11y), and Ladle's default-config source. Repo grounding:
`packages/component-lib/{.ladle,vite.config.ts,CLAUDE.md,src/story-coverage.test.ts}` and
`docs/design-system/{canonical-primitive-language.md,style-unification-pass.md}`.
