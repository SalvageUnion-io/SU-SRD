# YITUN Revamp — Design System Implementation Plan

**Branch:** `yitun-revamp`
**Source:** Claude Design handoff bundle (`itun/` — README + `chat1.md` + `project/`), share `2KONmXPURpeZsyKd4LmN6Q`.
**Sequence:** Foundations → SRD (`suref-web`) → ITUN (`in-the-union-now`).
**Design medium:** HTML/CSS/JS prototype (`itun.css`, `board-*.jsx`). We **recreate the visual output** in the repo's real stack (React 19 + Tailwind v4 + suref-react), per the bundle README — we do **not** copy the prototype's `.ec`/`.itun` class system in.

---

## 0. Guiding decisions (resolved)

- **Type voice = Barlow superfamily** (final landed direction; the mid-chat "Fira Code" choice was reverted). `itun.css` and `index.html` both load **Barlow** (body/data/UI) + **Barlow Semi Condensed** (titles, tags, stamped manual labels).
- **Palette is already correct.** `itun.css` is "ported 1:1 from `suref-react/styles/theme.css`." Every accent (orange/orange-dark/pink/green-dark/blue-game/rust/grey-dark), TL1–6, and status color already exists in `theme.css`. **No `su-*` hex changes.**
- **Entity cards = align the existing shared components**, not a new system. The prototype's `.ec` card is a re-draw of the repo's `DisplayCard` / `ReferenceEntityDisplay`. We tune those to match the artboard (type, accent-by-type/TL, footer/flavor). The card's display states **already exist** as the orthogonal `compact` + `listing` booleans — we reuse them, not add new props.
- **Tokens live once** in `packages/suref-react/src/styles/theme.css` and are inherited by both apps via `@import 'suref-react/styles/theme.css'`. The core-token work lands in Phase 0 and both apps pick it up.
- **Dark mode is out of scope.** The prototype's "hangar" dark theme is **not** being implemented — light ("workshop") only. We ignore the `.theme-hangar` rules in `itun.css` and the dark artboards entirely.

---

## 0.5 Scope guardrails (hard constraints)

This is a **styling/visual** effort. Stay inside these lines:

- **Styles only.** Allowed: design tokens (`theme.css`), CSS/Tailwind classes, font loading, and the *presentation* of existing components (markup needed to render the new look). **Not allowed** unless strictly required to carry a style: data schemas, Zod validation, stores/state, query/data-flow, routing, rule functions, component **behavior** or public **prop contracts**.
- **Foundational changes only when a style needs them.** e.g. adding `--font-cond` and repointing `--font-mono` is required for the type swap (allowed). Reworking a component's logic to "improve" it is **not** in scope.
- **Reuse existing prop contracts.** Entity-card display states use the existing `compact` + `listing` booleans (§2.3) — no new/renamed/removed props. Don't change function signatures that tests or other call sites depend on.
- **Tests stay green and untouched.** The existing suites (`bun test`, per-package tests) must keep passing **without editing test files**. If a test asserts a specific old style value (e.g. a Fira Code class, a hex, a `mode` string), **stop and flag it for review** rather than editing the test or bending the design around it — a handful of such snapshots/assertions may need a deliberate, separately-called-out update, but that is the exception, not a license to rewrite tests.
- **No new dependencies, no file restructures/moves** beyond what a style change needs (e.g. removing a dead font file).

---

## 1. Core token updates (the heart of Phase 0)

All in `packages/suref-react/src/styles/theme.css` (`@theme` block) unless noted.

### 1.1 Typography — the primary change
| Token | Today | Target | Notes |
|---|---|---|---|
| `--font-mono` | `'Fira Code', …monospace` | `'Barlow', system-ui, -apple-system, sans-serif` | Repointing this one token swaps **all** body/data/UI type repo-wide via the existing `font-mono` utility. |
| `--font-cond` | *(none)* | `'Barlow Semi Condensed', 'Barlow', system-ui, sans-serif` | **New** — generates a `font-cond` utility for titles, entity-card tags, section/eyebrow labels, "SALVAGE UNION WORKSHOP MANUAL · PAGE NN" stamps. |

> Decision: keep the **name** `--font-mono` (it's referenced everywhere as `font-mono`) but point it at Barlow. Cleanest possible diff; one token flips the whole body voice. Add `--font-cond` alongside.

**Font hosting = web fonts (Google Fonts), not self-hosted.** Keep the families loadable from the CDN — the same `<link>` the prototype's `index.html` uses:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@500;600;700&display=swap" rel="stylesheet" />
```
- **suref-web:** add the three `<link>` tags to `apps/suref-web/src/layouts/BaseLayout.astro` `<head>`; remove the Fira Code `@font-face` block in `global.css` and the `FiraCode-Variable.woff2` preload in `BaseLayout.astro`.
- **ITUN:** add the same `<link>` tags to `apps/in-the-union-now/index.html` `<head>`; remove the Fira Code `@font-face` block in `src/index.css`.
- Remove now-dead `FiraCode-Variable.woff2` files from both `public/fonts/` once nothing references them.
- No `public/fonts/` additions; no `@font-face` for Barlow (the Google CSS provides it).

### 1.2 New derived tokens
| Token | Value | Purpose |
|---|---|---|
| `--color-su-ink-soft` | `rgb(70,61,49)` (`#463d31`) | Secondary body text (`--ink-2` in prototype). |
| `--color-*-deep` set | per accent (e.g. pink-deep `#7e2a5b`, blue-game-deep `#235f7c`, green-dark-deep `#2f4338`, orange-light flavor `#f6dccb`) | Italic flavor-text / footer accent tones used by entity cards. Add only the ones cards actually consume. |
| `--radius` (ITUN already 0.375rem) | confirm tight `3px` card radius vs ShadCN default | Entity cards use a tight 3px radius; reconcile with ShadCN `--radius`. |

> **No dark-mode tokens.** The prototype's `--hg-*` ground family and `.theme-hangar` rules are intentionally **not** ported.

---

## 2. Phase 0 — Foundations (`suref-react`)

**Goal:** land the token layer + bring the shared display primitives to the artboard spec, so both apps inherit the look.

1. **Typography tokens + fonts** (1.1). Verify `font-mono`/`font-cond` utilities resolve.
2. **Derived + dark tokens** (1.2, 1.3).
3. **Entity card alignment** — bring `DisplayCard` / `CardHeader` / `ReferenceEntityDisplay` to match `board-cards.jsx` + `itun.css`:
   - Title in Barlow Semi Condensed on the black "stamp" bar; tags/labels in `font-cond`; body/flavor per spec.
   - **Display state — reuse the existing two-boolean API; do NOT add new props.** `DisplayCard` / `ReferenceEntityDisplay` already expose exactly this dichotomy:
     - **`compact?: boolean`** — reduced sizing (min-height, padding, border width, font/stat sizes). This *is* the full⊕compact size axis (`compact=false` → full).
     - **`listing?: boolean`** — header-only; hides body, footer, and tabs. Already documented "**Orthogonal to compact**" — combines with either size. (`.claude/rules/display-system.md` codifies both.)
     - Mapping from the prototype: design `compact` → existing **`compact`**; design header-only (`.ec--head`) → existing **`listing`**. Valid combos already work: full, compact, full+listing, compact+listing.
     - **Phase 0 here = restyle within this existing structure** (Barlow type, accent-by-type/TL, footer/flavor) — not an API change. The prototype's single exclusive `mode` in `board-cards.jsx` is *not* copied; the repo's orthogonal `compact`/`listing` is already correct.
   - Accent rule: abilities by tier (orange / orange-dark / pink); Equipment, Systems, Modules, Drones, Vehicles by **Tech Level**; Crawler Bays pink; Chassis green-dark; Denizens rust; Traits/Reference grey. (Matches `catalogColors.ts`.)
   - Footer: "SALVAGE UNION WORKSHOP MANUAL · PAGE NN" stamp tags; remove old footer border; enlarge flavor text.
4. **Shared primitives** used by screens: confirm `StatDisplay`/`StatsBar`/pip-tracker, `.pill` (pilot/mech/crawler), buttons/fields, section eyebrow, stepper map to existing components or add minimal additions.
5. **Verify:** `bun run build:package` (if types touched), `bun run typecheck`, `bun --filter suref-react test`, `bun run lint`. Screenshot the entity-display test/storybook surface for visual confirmation before Phase 1.

**Cross-app guard:** changing shared components risks both apps — after Phase 0, smoke-check `suref-web` and ITUN render (Tailwind `@source` paths, imports).

---

## 3. Phase 1 — SRD (`suref-web`)

Target boards: `board-srd.jsx` (Index, Browse·Systems, Entity detail, Browse·mobile) + `itun.css` `.srd*` rules. **suref-web is static; it shares the design system with ITUN, not data.**

1. **Typography**: inherits Phase 0 tokens; ensure Barlow preloads in the Astro layout; drop Fira Code.
2. **Catalog tiles** (`catalogColors.ts` is already category/TL-aware): render full-color tiles — white text, black border, text-shadow — using the category gradients (`GRAD_CLS` classes 60/40, `GRAD_AB` tiers, `GRAD_TL` six-stop, solid green Chassis, pink Crawlers/Bays, grey Reference).
3. **Nav** (`.srdnav`): black bar, "SALVAGE **UNION** SRD" (orange UNION), uppercase `font-cond` links, "Buy the Game" primary button, search field, TL filter chips, breadcrumbs.
4. **Entity detail = entity only** (no sidebar) using the Phase 0 card.
5. **About page** riveted-metal panel: port `.pilot-panel` component (already exists in `global.css` per the prototype comment — reconcile, don't duplicate).
6. **Verify:** `bun --filter suref-web test`, typecheck, lint, `bun run dev` smoke + screenshots of Index / Browse / Detail for sign-off.

---

## 4. Phase 2 — ITUN (`in-the-union-now`)

Target boards: `board-screens.jsx` (dashboard, pilot sheet/detail), `board-mech.jsx`, `board-crawler.jsx`, `board-wizard.jsx`, `board-extra.jsx`, `board-gallery.jsx`, plus uploads `01–16`. Reuse shared components (DisplayCard, StatDisplay, StatsBar, SheetDisplay, DualColumnLayout) — **do not** build one-off UI.

1. **App shell + typography**: inherits Phase 0; add the Barlow Google-Fonts `<link>` to `index.html`, remove ITUN's Fira Code `@font-face`; confirm `body` font-mono.
1b. **ITUN theme switching — confirmed none exists** (scan: 0 `dark:` variants, no theme provider/toggle, no `prefers-color-scheme`; "dark" hits are only color names like `su-orange-dark`). No removal needed; ITUN is already single-theme. Just don't introduce dark mode.
2. **Dashboard / Saved Builds**: `.row` list, `.pill` entity badges, `.empty` states, section eyebrows.
3. **Pilot wizard** (Class → Abilities → Equipment → Identity → Background → Review): `.stepper`, `.pick` selection cards for Class (not entity cards), entity cards for Abilities/Equipment, fields, budget chips.
4. **Mech builder** (Chassis → Systems/Modules → Sheet) and **Crawler builder** (Chassis → Bays/Systems → Sheet): `.pick` for Chassis/Crawler; entity cards (TL-colored) for Systems/Modules; pink for Crawler Bays.
5. **Live Sheet** (`PilotSheet`/`MechSheet`/`CrawlerSheet` via `Sheet`): stat/pip trackers (HP/AP/TP/SP/EP/Heat), click-to-edit (`EditableStatRow`/`InlineEditField`), conditions, two-pane wired layout — restyled to artboards. Fully responsive (phone trackers).
6. **Detail/edit + Share/snapshot/print** (`SnapshotView`, print.css): apply the system.
7. **Verify per sub-area:** typecheck immediately after edits (prop pass-through), `bun --filter in-the-union-now test`, lint, `bun run dev:itun` smoke + screenshots (desktop + mobile) for sign-off.

---

## 5. Global verification & sequencing

- After **every** cross-package change: `bun run typecheck`, relevant package tests, `bun run lint`. Before declaring a phase done: `bun run check:all`.
- **The existing test suite must stay green without editing tests** (per §0.5). Run tests after each change to confirm no behavior regressed. If a purely-visual assertion (font class / hex / `mode` literal) breaks, surface it for explicit review — don't silently edit tests or distort the design to satisfy a stale assertion.
- Land as a sequence of reviewable commits (conventional-commit style) on `yitun-revamp`: `feat(tokens):` → `feat(suref-react):` cards → `feat(suref-web):` SRD → `feat(itun):` per screen.
- Each phase ends with a screenshot checkpoint for your confirmation before the next begins (per project UI rule — confirm visual via screenshot before iterating).

## 6. Open / to-confirm at execution
- **Font weights/instances** to ship (Barlow 400/500/600/700; Barlow Semi Condensed 500/600/700) — variable vs static woff2.
- **suref-web About page** `.pilot-panel`: confirm the existing `global.css` implementation matches the prototype before porting.
- **Existing ITUN theme switching** (Phase 2 step 1b): ✅ confirmed — none present, nothing to remove.

> **Out of scope (explicit):** dark mode / the prototype's "hangar" theme. ITUN ships **single-theme (light/workshop) only**; any existing dark/light switching is removed (Phase 2 step 1b). Barlow is loaded as a **web font** (Google Fonts), not self-hosted.
