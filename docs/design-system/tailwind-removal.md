# Tailwind removal — the phased plan (#802)

> **Status:** Funded plan, dated **2026-09-25**. Decision: fund the removal with
> a plan, and run it phase by phase against the ratchets below. Executing the
> whole migration is **not** part of the audit that wrote this; each phase is
> its own PR series.
>
> **Supersedes nothing yet.** An ADR recording the styling change is a phase 6
> prerequisite (see there); until it lands, this document and the epic
> ([#802](https://github.com/SalvageUnion-io/SU-SRD/issues/802), layers
> #798 → #799 → #800 → #801) are the record.
>
> This file also holds the styling reasoning that used to live in
> `packages/component-lib/CLAUDE.md` — cascade proofs, the focus-visible trap,
> the layer-order check. That file now keeps only the rules an editor of the
> package needs; the evidence behind them is here.

## 1. Where we are: four styling systems at once

| System | Where | Size (2026-09-25) | End state |
| --- | --- | --- | --- |
| Tailwind utilities | `className=` / `cn()` / `cva()`, plus class strings held in constants and lookup maps, in the three UI workspaces | **329 files** (`tailwind-utility-file`) | gone |
| `.su-*` package stylesheet | `packages/component-lib/src/styles/index.css` | 894 lines | **stays** — the one stylesheet |
| `theme.css` (`@theme`) | `packages/component-lib/src/styles/theme.css` | 490 lines | folded into `index.css`, deleted |
| Dashboard `.pc-*` scope | `styles/dashboard/{DashboardCanvas,DashboardGrid,instruments}.css` via `styles/dashboard.css` | **129 classes** (`pc-class-defined`), ~1,370 lines | folded into `.su-*`, deleted |
| Typed tokens | `packages/component-lib/src/design/tokens.ts` | imported by 8 `.tsx` files, all Ladle catalog pages or harnesses | **stays** — the one token source |

Tailwind files by workspace: `apps/itun` 88, `apps/srd` 24, component-lib 217
(`shared` 65, `chrome` 52, `referenceEntity` 25, `dashboard` 21, `wizard` 20,
`sheet` 11, `stat` 8, the rest ≤ 3). **Moved the same day** by the component-lib
boundary audit (PK-02/PK-03), which took ITUN-only and srd-only components out
of the library: now `apps/itun` 138, `apps/srd` 29, component-lib 159
(`shared` 61, `chrome` 52, `referenceEntity` 23, `stat` 8, the rest ≤ 3), 326
in all. The Dashboard, sheet and wizard files are ITUN's now, so they migrate
in P6 rather than P4/P5; the phase boundaries below say so. `bun tools/check-styling.ts --report` prints the
current per-file list; it is the work-list, so it is not copied here.

**End state: one system** — `tokens.ts` for values, `index.css` for every rule
a style object cannot express, and nothing else. No `@theme`, no utilities, no
`.pc-*`, no `cn()`/`tailwind-merge`/`class-variance-authority` doing Tailwind
conflict resolution.

## 2. The ratchets (in force now)

Neither Tailwind nor a stylesheet errors when it grows, so without a ratchet
the backlog refills as fast as a phase drains it. Two ratchet rules
in `tools/rules/stylingOwnership.ts` (`bun run check styling`, in `check`, at
pre-push and in CI) make the retiring systems a number that can only go **down**:

| Rule | Counts | Baseline |
| --- | --- | --- |
| `tailwind-utility-file` | UI source files (stories included, tests excluded) with ≥ 1 Tailwind utility — in a class-list context, or as a class string held elsewhere | 343 |
| `pc-class-defined` | distinct `.pc-*` classes defined by the Dashboard stylesheets | 129 |

The `tokens` rule set (`tools/rules/designTokens.ts`) ratchets the same way on
raw colours (21) and arbitrary font sizes (2). All four counts live in
`tools/styling-baseline.json`, and the ratchet is strict both ways: a count that
falls without the baseline falling fails too, so a freed slot cannot be spent.

The detector (`tools/lib/tailwindClasses.ts`, unit-tested) reads two places:
every utility in a `className=` value or a `cn(` / `clsx(` / `cva(` argument,
and every **other** string literal made wholly of utilities — the
`const DARK_BUTTON = 'border-paper/40 …'` constant and the
`{ '1': 'bg-tl-1 text-ink' }` lookup map, which the first version of the scan
missed in 13 files. Outside a class-list context it is deliberately
conservative: a style object's `display: 'flex'` — the pattern the migration
moves **to** — never counts, nor does a lone bare token (`'hidden'`) or a lone
CSS keyword / header name that shares a utility's shape (`'flex-start'`,
`'content-type'`). It is still a heuristic, so it is **not** the final
oracle — the built CSS is (see P6's exit).

**A pure file split is the one other way the file count may rise.** The rule
counts files, so splitting a Tailwind-carrying file raises it without a utility
being written. Audits PK-08 / AP-16 did this once (326 → 343, raised with
`--allow-increase`), with the utility total over every touched file falling
773 → 767; the record is in `tools/rules/stylingOwnership.ts`. A split that
cannot show its utility total did not rise is drift.

**Every phase PR lowers the baselines** with
`bun tools/check-styling.ts --update-baseline` and commits the JSON. A PR that
migrates files and leaves the baseline where it was now fails — before the
ratchet was strict, it handed the freed headroom to the next PR that added
Tailwind.

## 3. The phases

Strictly ordered: component-lib before the apps (both consume it), and the
Dashboard scope after the component-lib groups it depends on.

### P0 — Foundations ✅ (landed)

`tokens.ts`, `index.css`, the `--su-*` custom properties, the per-property split
rule (§4), `tokens.parity.test.ts`, the layered `ladle.css` import, and the
`package-stylesheet-import` guard. The Foundations Ladle group carries no
Tailwind. The ratchets in §2 landed with this plan.

### P1 — Close the alpha-rung gap (design call, blocks P2)

Tailwind's `/NN` opacity modifier is an **open** mechanism and `tokens.ts` is a
**closed** set. As of the last count, 34 alpha usages across 17 non-story files
have no matching rung, in 17 spellings: `ink/5`, `ink/35`, `ink/55`, `ink/60`,
`ink/70`, `paper/10`, `paper/15`, `paper/40`, `paper/55`, `paper/70`,
`paper/80`, `paper/85`, `paper/95`, `rust/25`, `caution/25`, `status-bad/25`,
`wk-faint/80`.

Rounding one to a neighbouring rung is a re-tone, and a raw `rgb(… / .NN)` at
the call site is a `tokens/raw-color` violation, so adding rungs is the
only legal move — but choosing which rungs the system owns enlarges the closed
colour set and is a **design** decision, not a port.

- **Exit:** every spelling above either has a rung in `tokens.ts` **and** a
  `--su-*` property (parity test green), or its call site has been redesigned
  away. Atoms needs four (`paper/70` Stat, `ink/55` + `ink/70` VitalGauge,
  `status-bad/25` InlineEditField); Containers seven more; Compositions the
  rest.
- `rust/25` is already resolved: Toggle's 25% focus wash measured 1.42:1 against
  a required 3:1 and moved to the offset ring. The `rust25` rung survives for
  `RosterSkeleton`'s genuine wash.

### P2 — component-lib Atoms

- **Scope:** every file behind an `Atoms/*` Ladle story.
- **Exit:** no Atoms file in `check-styling.ts --report`'s `tailwind-utility-file`
  list; Ladle renders the group identically to `main` (screenshot pair in the
  PR); baseline lowered.

### P3 — component-lib Containers

Same shape and exit criteria as P2, for `Containers/*` (`Card`, `ModalShell`,
the chrome shells — the bulk of `shared/` and `chrome/`).

### P4 — component-lib Compositions (excluding the Dashboard)

The library's `Compositions/Entity`, `/Catalog` and `/Shell` stories and the flat Compositions
leaves — `referenceEntity/` and the rest of `shared/`. (The `/Wizard` and `/Dashboard` sub-groups,
and the sheet presentation, are ITUN's own components since PK-02; they migrate with the app in P6.)

- **Exit:** no component-lib file is left in the `tailwind-utility-file` list.

### P5 — The Dashboard `.pc-*` scope

The Dashboard ("Pit HUD") is a second stylesheet system of its own: a
`.pc-root` custom-property scope, ~1,370 lines of `.pc-*` rules across three
files, and the `pc-class-contract` guard that keeps it closed. It is a phase,
not a footnote, because it is the largest single stylesheet in the repo and the
one most likely to be left behind "because it already works".

- Fold each `.pc-*` rule into a `.su-*` class in `index.css` (or a style
  object, per §4), move the `.pc-root` properties onto `--su-*` tokens, and
  migrate the Tailwind files under `apps/itun/src/components/dashboard/`.
- Delete `styles/dashboard.css` and its package export once empty; ITUN's
  `Dashboard.tsx` import goes with it.
- **Exit:** `pc-class-defined` is 0 and the rule plus `pc-class-contract` are
  deleted; no `apps/itun/src/components/dashboard/` file in the Tailwind list; the Dashboard
  Ladle stories and the ITUN dashboard route render identically to `main`.

### P6 — The apps

`apps/itun` (138 files, the Dashboard's excepted if P5 has taken them) then `apps/srd` (29). srd's output gate does **not**
cover this — it digests `<main>` text, not markup or CSS (see `/srd-gate`) — so
each srd PR carries a visual check of the affected pages.

- **Prerequisite:** the ADR recording the styling change (tokens + one
  stylesheet replacing "Base UI + Tailwind v4"), written before the first app
  PR so the apps' docs have something to point at.
- **Exit:** `tailwind-utility-file` is 0 **and** no rendered element carries
  a class that the built CSS defines as a Tailwind utility. The second half is
  the oracle the first cannot be — it catches a class list the heuristic scan
  missed (a string built by concatenation, a class passed through data) — and
  it is measured on the **DOM**, not on the stylesheet:
  - Take the utility selectors from the built CSS of each surface (srd's
    `dist/assets/styles-*.css`, ITUN's build, Ladle's build): the class names
    inside `@layer utilities`.
  - Take the class tokens actually present on elements: srd's built HTML
    **plus** the DOM after its islands mount (they render client-side only, so
    the static HTML alone misses them), ITUN's routes, and every Ladle story —
    crawled with the Playwright the repo already carries for `a11y-scan`.
  - The check passes when the intersection is empty. A non-empty intersection
    is the work-list: each entry names an element and a utility it still
    depends on.

  **An empty `@layer utilities` is not the check, and never will be.**
  Tailwind v4 scans every source file as plain text — comments, JSDoc, page
  copy, JSON — and emits a rule for any utility-shaped word. Measured at
  `c0560252`, srd's built CSS already carries `.static`, `.collapse`,
  `.container`, `.visible`, `.table`, `.list-item`, `.shadow`, `.outline`,
  `.filter`, `.blur` and `.resize`, sourced from comments
  (`EntityCardStatic.tsx`, `ColophonIsland.tsx`, `ssg/build.ts`), an inline
  `<style>` block in `greembeem.page.tsx`, and `ssg/output-snapshot.json`. None is a
  class anything depends on, so a gate on the layer being empty would fail
  forever after the migration finished — and a gate that cannot pass gets
  waived. The DOM intersection ignores those rules because no element uses
  them.

  Its limit is coverage: it sees only the states the crawl reaches, so a class
  applied on an interaction or an error path it never triggers is invisible to
  it. For those, the per-PR visual check above is the backstop — or, once
  before P7, a screenshot diff of the same crawl with the `tailwindcss()`
  plugin removed from both Vite configs, which catches any element that loses
  styling regardless of where its class came from.

### P7 — Remove Tailwind

- Drop `tailwindcss`, `@tailwindcss/vite` (catalog + three manifests),
  `tailwind-merge`, and the `tailwindcss()` plugin from `apps/itun/vite.config.ts`
  and `apps/srd/ssg/vite.config.ts`.
- Fold `theme.css`'s `@theme` block into `index.css`'s `--su-*` properties and
  delete `theme.css`; reduce `cn()` to a plain class joiner or delete it.
- Import `index.css` **unlayered** in both apps (the `layer(su-base)` wrapping
  exists only to lose to Tailwind's utilities) and rewrite the
  `package-stylesheet-import` guard to match.
- Delete the `tailwind-utility-file` rule and `tools/lib/tailwindClasses.ts`;
  re-target the `tokens` rule set from `@theme` entries to `tokens.ts`.
- **Exit:** `grep -ri tailwind` finds only historical references; `bun run
  check` green; built CSS size recorded before and after (#802's success list).
  None of those three notices an element that silently lost its styling — the
  srd gate digests text, not markup — so P7 must not start until P6's
  DOM-intersection check has passed on the commit it branches from.

## 4. The rules every phase applies

### The split is per-PROPERTY, not per-component

- **Style object** — a property with **no** stateful or responsive variant
  anywhere on that element: padding, border-radius, font, most layout.
- **Stylesheet class** — a property with **any** stateful or conditional
  variant (`:hover`, `:focus`, `:focus-visible`, `:disabled`, `@media`,
  pseudo-elements, sibling/child selectors) — **including its resting value.**
- A component routinely uses both: a Button's `padding` is an object, its
  `background-color` a class, because only the second one changes on hover.

**Why the resting value has to come along.** An inline `style=` declaration
outranks any author stylesheet rule regardless of selector specificity or
state — it sits higher in the cascade origin order. So splitting one property
across the two mechanisms is **silently broken**: the resting value wins
forever and the hover never fires. Measured on a real page, two identical
elements, one hovered at a time:

| resting `background-color` | computed value while hovered |
| --- | --- |
| inline `style=` | `rgb(0, 128, 0)` — the hover **did not apply** |
| in the class | `rgb(255, 0, 0)` — the hover applied |

**The capability half.** An inline `style={}` object cannot express a single
item on the stateful list. The UI workspaces depend on ~403 Tailwind variant
usages — 215 responsive, 120 `hover:`, 15 `focus-visible:`, 12 `disabled:`, 9
`focus:`, 5 structural. A migration to style objects alone would silently drop
every one, which is why `index.css` is not optional and why it grows faster
than "the bits an object cannot express" suggests: each stateful property drags
its resting value in with it. That growth is the rule working.

**`styles.ts` was deleted, and stays deleted.** L1 (#798) shipped 21
speculative `CSSProperties` objects; 20 never gained a consumer, and the pair
that mattered (`buttonPrimary` / `buttonSecondary`) put `backgroundColor`
inline while `index.css` hovered with `filter: brightness()` — a different
property, which sidesteps the collision above rather than resolving it. A
button's colours belong in a `.su-btn--*` class, resting value included.
Introduce a style object alongside the component that needs it; do not restore
a speculative set.

### The one exemption: class-string exports are stylesheet-only

`buttonVariants`, `capsLabel`, `FOCUS_RING`, `FOCUS_RING_ON_TONE`,
`FOCUS_WITHIN`, `INPUT_FOCUS`, `DISABLED`, `SELECTION_RING`,
`SELECTION_RING_INK_DOUBLE` return **class strings** so an app can style an
element the library never renders (both apps use `buttonVariants` on `<a>`).
A function that returns a string cannot return a style object without changing
its public signature, so **all** their styling — geometry included — lives in
`index.css`. Consequences: the `.su-*` names are public API (name them
deliberately), and the exemption does not leak to components the library
renders.

(The pattern is ported from `binfinite-app`, whose component library has zero
`:hover` and zero `@media` because it is React-Native-first. Here the style
objects would be asked to carry interaction and viewport state, and they
cannot — that is the one thing that must not be lost in translation.)

### Catalog-only rules go in `src/stories/_stories.css`

`index.css` is what every consumer loads; story-page layout ships in no app.

### Edit both token forms or neither

The scale exists as TypeScript (`tokens.ts`) and as `--su-*` properties
(`index.css`) because neither form can do the other's job.
`src/design/tokens.parity.test.ts` fails if they disagree.

## 5. While both systems are live

- `theme.css` stays the source of record and Tailwind works untouched: the
  token scale re-shapes the values already there; it is not a re-design.
- **Both app entry stylesheets and `src/styles/ladle.css` import `index.css`
  into `layer(su-base)`, declared before `utilities`.** `index.css` is written
  to be loaded alone once Tailwind leaves, so its base block is unlayered — and
  unlayered CSS beats layered CSS whatever the source order. A plain `@import`
  landed `h1,…,h6 { font-size: inherit }` past the utilities layer and
  flattened every heading. the `styling/package-stylesheet-import` rule
  guards the app side.

## 6. Verification traps (read before "checking" a style)

### `.focus()` does not trigger `:focus-visible`

`el.focus()` — from devtools, `userEvent`, or `fireEvent.focus` — moves focus
without satisfying the keyboard heuristic, so `:focus-visible` stays unmatched
and the computed `boxShadow` reads `none` on a ring that works. Worse, the rungs
disagree under that check, which reads as "applied unevenly":

| rung | selector | responds to `el.focus()`? |
| --- | --- | --- |
| `.su-focus-ring`, `.su-focus-ring-on-tone`, `.su-button` | `:focus-visible` | **no** |
| `.su-input-focus`, `.su-input` | `:focus` | yes |
| `.su-focus-within` | `:focus-within` | yes |

Send a real Tab key press, or assert `el.matches(':focus-visible')` alongside the
computed value, so a false negative is distinguishable from a real one.

### Layer order is set by the `@layer` declaration, not block position

Vite dev emits `su-base`'s block ~86 KB after the utilities block while the
production build emits it before — and both cascades are correct, because both
carry `@layer theme, base, su-base, components, utilities;` first. An
offset-comparing script is right on the build and wrong in dev. Verify a layer
question by reading the declaration (what `package-stylesheet-import` asserts)
or by a computed value from `getComputedStyle`, never by block position.
