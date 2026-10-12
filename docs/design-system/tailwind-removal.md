# Tailwind removal — the phased plan

Live plan; each phase is its own PR series. Paths below are under `packages/component-lib/` unless they name an app.

1. **§1 End state** — one system: `src/styles/theme.css` for values (mirrored by `src/design/tokens.ts`), `src/styles/index.css` for every rule a style object cannot express.
   No utilities, no `.pc-*`, no `@theme`; ITUN-only rules stay in ITUN because srd loads `index.css` too.
2. **§2 The ratchets** — `tailwind-utility-file` and `pc-class-defined` (`bun run check styling`) count down in `tools/styling-baseline.json`, strict both ways.
   Every phase PR runs `bun tools/check-styling.ts --update-baseline`; only a pure file split may raise a count (`--allow-increase`). `--report` is the work-list.
3. **§3 The phases** — strictly ordered: component-lib before the apps, the Dashboard after the groups it uses.
   - **P0 Foundations** — done: tokens, `index.css`, the parity test, the one Tailwind entry, the `package-stylesheet-import` guard.
   - **P1 Alpha modifiers** — `/NN` ports as `color-mix(in oklab, var(--color-x) NN%, transparent)` (`${color.x}` in a style object); an existing alpha rung wins.
   - **P2 Atoms** — every file behind an `Atoms/*` story. Exit: none left in `--report`, the catalog renders identically (screenshot pair), baseline lowered.
   - **P3 Containers** — `Containers/*`, same exit as P2.
   - **P4 Compositions** — `Compositions/Entity`, `/Catalog`, `/Shell` and the flat leaves. Exit: no component-lib file left in the Tailwind list.
   - **P5 Dashboard `.pc-*`** (open) — each rule to a style object or an ITUN stylesheet rule, never `index.css`; then delete `apps/itun/src/styles/dashboard.css`.
     Exit: `pc-class-defined` is 0, it and `pc-class-contract` are deleted, no `apps/itun/src/components/dashboard/` file in the Tailwind list.
   - **P6 The apps** — `apps/itun`, then `apps/srd` (each srd PR carries a visual check). Prerequisite: an ADR recording the styling change.
     Exit: `tailwind-utility-file` is 0 **and** no rendered element (srd HTML plus mounted islands, ITUN routes, every story; Playwright crawl) carries a class in built CSS's `@layer utilities`. An empty layer is not the check: Tailwind emits rules for words in comments.
   - **P7 Remove Tailwind** — only once P6's DOM check passes. Drop the packages and Vite plugins, `@theme` becomes `:root`, `index.css` unlayered, the ratchet and `tools/lib/tailwindClasses.ts` deleted.
     Exit: `grep -ri tailwind` finds only history; `bun run check` green.
4. **§4 The rules every phase applies**
   1. **Split per property** — no stateful or responsive variant on that element: style object. Any (`:hover`, `:focus-visible`, `@media`, pseudo-elements…): a `.su-*` class, resting value included, since inline `style=` beats every stylesheet rule.
   2. **No new `.pc-*` class** — new Dashboard UI is style objects over `tokens.ts` plus `.su-*` classes.
   3. **Class-string exports are stylesheet-only** — `buttonVariants`, `capsLabel`, the `FOCUS_*` / `DISABLED` / `SELECTION_RING*` set keep all styling in `index.css`; their `.su-*` names are public API.
   4. **No speculative style objects** — add one with the component that needs it.
   5. **Catalog-only rules go in `src/stories/_stories.css`** — `index.css` ships to every consumer.
   6. **Edit both token forms or neither** — `theme.css` and `tokens.ts`; `src/design/tokens.parity.test.ts` fails on disagreement.
5. **§5 While both systems are live** — `src/styles/tailwind.css` is the one Tailwind entry, importing `index.css` into `layer(su-base)` before `utilities`.
   Apps and `src/styles/catalog.css` import that entry, never Tailwind; `package-stylesheet-import` guards it.
6. **§6 Verification traps**
   1. **`.focus()` does not match `:focus-visible`** — send a real Tab or assert `el.matches(':focus-visible')`; the `:focus` and `:focus-within` rungs do respond.
   2. **Layer order comes from the `@layer` declaration** — dev and build place blocks differently; verify by the declaration or `getComputedStyle`, never block position.
