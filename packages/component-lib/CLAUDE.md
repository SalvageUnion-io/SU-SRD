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
| [`src/styles/index.css`](src/styles/index.css) | The **one** stylesheet a web consumer loads. Emits the scale as `--su-*` custom properties, binds the page ground and body face, and carries every rule a style object cannot express. |

Both halves of the pattern are load-bearing. The token scale is the visible half;
the stylesheet is the half that is easy to miss, and
dropping it would be a functional regression rather than a styling change.

### The split rule

**The split is per-PROPERTY, not per-component.** Decide it one CSS property at
a time, never one component at a time:

- **Style object** — a property with **no** stateful or responsive variant
  anywhere on that element: padding, border-radius, font, most layout.
- **Stylesheet class** — a property that has **any** stateful or conditional
  variant (`:hover`, `:focus`, `:focus-visible`, `:disabled`, `@media`,
  pseudo-elements, sibling/child selectors) — **including its resting value.**
- A component routinely uses both, splitting down the middle of its own style:
  a Button's `padding` is an object, its `background-color` a class, because
  only the second one changes on hover.

#### Why the resting value has to come along

Not a preference — a cascade fact, and the reason is what stops someone
"simplifying" this back. **An inline `style=` declaration outranks any author
stylesheet rule regardless of selector specificity or state**, because it sits
higher in the cascade origin order. `:hover` cannot beat it and no amount of
selector weight fixes that. So splitting one property across the two mechanisms
is not merely inelegant, it is **silently broken**: the resting value wins
forever, the stateful one never fires, nothing errors, and the only symptom is a
hover that does nothing.

Measured on a real page rather than argued from specificity — two identical
elements, one hovered at a time:

| resting `background-color` | computed value while hovered |
| --- | --- |
| inline `style=` | `rgb(0, 128, 0)` — the hover **did not apply** |
| in the class | `rgb(255, 0, 0)` — the hover applied |

Specificity intuition is exactly where this goes wrong, which is why the check is
a measurement and not an argument.

#### The capability half

The other half of the rule is a plain capability boundary: an inline `style={}`
object has no way to express a single item on the stateful list. Measured across
the three UI workspaces, the codebase depends on ~403 Tailwind variant usages —
215 responsive (`sm:`/`md:`/`lg:`/`xl:`), 120 `hover:`, 15 `focus-visible:`, 12
`disabled:`, 9 `focus:`, 5 structural. A migration to style objects alone would
silently drop every one of them.

#### Consequence: the stylesheet is bigger than it looks

Because a stateful property brings its resting value with it, `src/styles/index.css`
carries considerably more than "the bits an object cannot express". Within
component-lib alone there are ~127 stateful usages (81 `hover:`, 14 `disabled:`,
12 `focus:`, 11 `active:`, 9 `focus-visible:`), and each one drags its resting
`background-color` / `border-color` / `color` into the stylesheet with it. That
growth is the rule working, not scope creep.

#### `src/design/styles.ts` was removed, and #813 is why it is worth knowing

L1 (#798) shipped a `styles.ts` of 21 `CSSProperties` objects ahead of any
consumer. It never acquired one: measured before deletion, 20 had no consumer
anywhere and the 21st (`buttonBase`) was reached only by two of the other twenty.
It has been deleted rather than carried into L2 (#799).

This section previously read "nothing consumes the two objects yet, so they are
left in place rather than churned", and that sentence was cited as the governing
decision — so it is replaced rather than dropped, to avoid a reader finding the
old wording and reinstating the file.

The defect it recorded is the reason deleting beat keeping. `buttonPrimary` /
`buttonSecondary` put `backgroundColor` inline, and `index.css` paired them with
`.su-button:hover { filter: brightness(0.94) }`. That renders only because
`filter` is a **different property** from `background-color`, so it sidesteps
the collision above instead of resolving it, and it does not generalise: the
real `Button` swaps to a NAMED colour per variant (`hover:bg-ink-8`,
`hover:bg-rust-hi`, `hover:border-rust-hi`), which a brightness filter re-tones
rather than ports.

**The rule that outlives the file:** a button's colours belong in a
`.su-btn--*` class, resting value included. When L2 migrates a component,
introduce the style object it needs alongside that component — do not restore a
speculative set designed before its call sites were understood.

### The one exemption: class-string exports are stylesheet-only

The split rule governs **components** — things this library renders. A handful of
exports are not components but **class strings**, and for those there is no
element for a style object to attach to, so *all* of their styling lives in
`src/styles/index.css`. Geometry and type included, not just the stateful half.

The members, and anything built on them:

| export | shape |
| --- | --- |
| `buttonVariants` | `(opts) => string` — the `.btn` recipe |
| `capsLabel` | `(opts) => string` — the condensed-caps label recipe |
| `FOCUS_RING`, `FOCUS_RING_ON_TONE`, `FOCUS_WITHIN`, `INPUT_FOCUS` | the focus vocabulary |
| `DISABLED` | the disabled treatment |
| `SELECTION_RING`, `SELECTION_RING_INK_DOUBLE` | the selection rings |

This is the rule's **boundary, not an escape from it.** These exports exist
precisely so a consuming app can style an element the library never renders —
`buttonVariants`' own doc comment puts it as *"a design system the consuming apps
cannot import is one they will re-invent"*, and both apps use it on `<a>`
elements. A function that returns a string cannot return a style object without
changing its signature, and its signature is public API. So they were always
going to be stylesheet-only the moment Tailwind left: a class name is the only
thing they can carry.

Two consequences to hold onto:

- **The `.su-*` names are public API.** Apps compose them with `cn()`, so they
  end up in app-side code and cannot be churned cheaply. Name a new one
  deliberately the first time.
- **Do not let the exemption leak.** A component this library *renders* still
  follows the per-property split, even when it is convenient to move everything
  into a class. The exemption is for exports whose contract is literally a class
  string — nothing else.

(The pattern is ported from `binfinite-app`, whose component library has zero
`:hover` and zero `@media` because it is React-Native-first and RN has neither —
so its style objects were never asked to carry interaction or viewport state.
Here they would be, and they cannot. That is the one thing that must not be lost
in translation, and it is why the stylesheet is not optional.)

### Checking a focus style: `.focus()` will lie to you

**`:focus-visible` does not match programmatic focus.** Calling `el.focus()` — or
`.focus()` from a devtools console, or `userEvent`/`fireEvent.focus` in a test —
moves focus without satisfying the browser's keyboard heuristic, so
`:focus-visible` stays unmatched and `getComputedStyle(el).boxShadow` reports
`none`. Every focus ring in this package is on `:focus-visible` (that is the
point — a button shows its ring to the keyboard, not to the mouse), so **a
working ring reads as a missing one** under that check.

That is the dangerous direction: it makes a correct feature look broken, which
invites someone to "fix" it until it really is. Verified on the real thing —
`el.focus()` gave `boxShadow: none` on a Button whose ring was fine, while a real
**Tab** press gave `matchesFocusVisible: true` and a computed `boxShadow`.

(That measurement was originally recorded against the ring's old value,
`rgba(168, 82, 34, 0.25) 0 0 0 3px`. The ring has since changed — see
`--focus-ring-shadow` — so the *value* is not restated here: a literal in this
doc is a second copy that goes stale the next time the ring moves, and the point
of the section is the `:focus-visible` trap, which is unaffected.)

So to check a focus style: send a real key press (a browser driver's Tab key), or
assert `el.matches(':focus-visible')` alongside the computed value, so a false
negative is distinguishable from a real one.

#### The worse half: the two rungs disagree under the same check

**Only the `:focus-visible` rungs are affected. The `:focus` rungs respond to
`.focus()` perfectly well.**

| rung | selector | responds to `el.focus()`? |
| --- | --- | --- |
| `.su-focus-ring` | `:focus-visible` | **no** |
| `.su-focus-ring-on-tone` | `:focus-visible` | **no** |
| `.su-button` | `:focus-visible` | **no** |
| `.su-input-focus` | `:focus` | yes |
| `.su-input` | `:focus` | yes |
| `.su-focus-within` | `:focus-within` | yes |

That split is worse than the original trap, and it is the reason this is a
section rather than a footnote. Spot-check a handful of components with
`.focus()` and the results are *internally inconsistent*: inputs light up,
buttons do not. The natural reading is "the focus treatment is applied
unevenly — some components got it, some were missed", and someone then goes
looking for the components that were "missed". Every one of them is correct;
the check is the variable.

The failure mode is not "I could not verify this". It is **"I verified it and
concluded something false"**, which is the one that produces work. If two focus
rungs ever appear to disagree, confirm the selector each one uses before
concluding anything about the components.

### Checking cascade layers: assert on the DECLARATION, never on block position

**Layer order is set by the first `@layer` declaration, not by where the blocks
land in the file.** So checking a cascade by finding the `@layer name { … }`
blocks and comparing their byte offsets measures the wrong thing — and it does
not fail honestly, because it is right in one environment and wrong in another.

Measured both ways on this repo's own wiring, which imports the package
stylesheet into `su-base` (see `apps/*/src/**.css`):

| | block order | actual cascade |
| --- | --- | --- |
| production build | `base` → `su-base` → `utilities` | correct |
| Vite dev | `base` → `utilities` → … → `su-base` | **also correct** |

Dev emits `su-base`'s block ~86 KB after the utilities block, so an
offset-comparing script reports the cascade inverted. It is not: both outputs
carry `@layer theme, base, su-base, components, utilities;` ahead of Tailwind's
own declaration, and that line decides. Confirmed by injecting an
`<h2 class="text-2xl">` into the running dev app and reading **24px** rather than
the inherited 14px — Tailwind's utility still outranks the `su-base` heading
reset, exactly as in the build.

So verify a layer question one of two ways, and never by block position:

- **the declaration** — find the bare `@layer a, b, c;` and read the order off
  it. This is what `check:styling`'s `package-stylesheet-import` rule asserts.
- **a computed value** — render the real thing and read
  `getComputedStyle(el)`, which cannot be fooled by emission order at all.

The reason this one is worth writing down: the offset method was *decisive* on
the production bundle and *false* in dev, which makes it far harder to distrust
than a method that is simply wrong. A scratch tool that agrees with you once
earns credibility it has not got.

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

**The Atoms layer is blocked on four of them**: `paper/70` (Stat), `ink/55` +
`ink/70` (VitalGauge), `status-bad/25` (InlineEditField).
Containers needs seven more, Compositions the rest.

`rust/25` (Toggle) was the fifth and is **no longer a blocker**: Toggle's focus
ring was a 25% wash measuring 1.42:1 against a required 3:1, so it moved to the
offset ring alongside every other rung and the alpha usage went with it. The
`rust25` rung still exists — `RosterSkeleton`'s ghost fill is a genuine wash —
but no *focus* treatment depends on an alpha rung any more.

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
