# Tailwind removal — the phased plan

Done: the record of the migration; each phase was its own PR series. Paths below are under `packages/component-lib/` unless they name an app.

1. **§1 End state (reached)** — one system: `src/styles/theme.css` for values (mirrored by `src/design/tokens.ts`), `src/styles/index.css` for every rule a style object cannot express.
   No utilities, no `.pc-*`, no `@theme`; ITUN-only rules stay in ITUN because srd loads `index.css` too. The working rules are `.claude/rules/styling.md`.
2. **§2 The ratchets (retired in TW7)** — `tailwind-utility-file` and `pc-class-defined` counted down in `tools/styling-baseline.json`, strict both ways, to 0.
3. **§3 The phases** (TW0–TW7; the `[design-refresh Pn]` commit tags are [another ledger](refresh-ledger.md)) — strictly ordered: component-lib before the apps, the Dashboard after the groups it uses.
   - **TW0 Foundations** — done: tokens, `index.css`, the parity test, the one Tailwind entry, the `package-stylesheet-import` guard.
   - **TW1 Alpha modifiers** — applied file by file with each group (TW2 onward): `/NN` ports as `color-mix(in oklab, var(--color-x) NN%, transparent)` (`${color.x}` in a style object); an existing alpha rung wins.
   - **TW2 Atoms** — done: every file behind an `Atoms/*` story. Exit: none left in `--report`, the catalog renders identically (screenshot pair), baseline lowered.
   - **TW3 Containers** — done: `Containers/*`, same exit as TW2.
   - **TW4 Compositions** — done: `Compositions/Entity`, `/Catalog`, `/Shell` and the flat leaves. Exit: no component-lib file left in the Tailwind list.
   - **TW5 Dashboard `.pc-*`** — done (TW-f): every rule renamed to an ITUN `.su-dash-*` rule in `apps/itun/src/styles/dashboard/`, none in `index.css`; `dashboard.css` stays as the ordered import bundle.
     Exit met: `pc-class-defined` is 0 and kept until TW7 as the ban on any `.pc-*` class; `pc-class-contract` now checks `su-dash-*` (used ⇔ defined); no `apps/itun/src/components/dashboard/` file in the Tailwind list.
   - **TW6 The apps** — done (TW-d, TW-e, TW-g, TW-h; [ADR-046](../ARCHITECTURE.md#decisions)). Exit met (TW-i): `tailwind-utility-file` 0, and a Playwright crawl of every srd page, the signed-out ITUN routes and every story found no element carrying a class from built CSS's `@layer utilities`; the one live hit (the toaster's icon colour) moved to `.su-toast--*`.
   - **TW7 Remove Tailwind** — done (TW-i): packages, Vite plugins and `tailwind-merge` dropped; `@theme` is `:root`; `entry.css` layers `reset.css` (the preflight, adapted) and `index.css` under the unlayered apps; the ratchets and `tools/lib/tailwindClasses.ts` deleted; `pc-class-contract` is `dash-class-contract`. Exit met: `grep -ri tailwind` finds only history; `bun run check` green.
4. **§4 The rules every phase applies**
   1. **Split per property** — no stateful or responsive variant on that element: style object. Any (`:hover`, `:focus-visible`, `@media`, pseudo-elements…): a `.su-*` class, resting value included, since inline `style=` beats every stylesheet rule.
   2. **No `.pc-*` class** — new Dashboard UI is style objects over `tokens.ts` plus `.su-*` / ITUN `.su-dash-*` classes.
   3. **Class-string exports are stylesheet-only** — `buttonVariants`, `capsLabel`, the `FOCUS_*` / `DISABLED` / `SELECTION_RING*` set keep all styling in `index.css`; their `.su-*` names are public API.
   4. **No speculative style objects** — add one with the component that needs it.
   5. **Catalog-only rules go in `src/stories/_stories.css`** — `index.css` ships to every consumer.
   6. **Edit both token forms or neither** — `theme.css` and `tokens.ts`; `src/design/__tests__/tokens.parity.test.ts` fails on disagreement.
5. **§5 While both systems were live** — `src/styles/tailwind.css` was the one Tailwind entry, importing `index.css` into `layer(su-base)` before `utilities`. TW7 replaced it with `src/styles/entry.css`; `package-stylesheet-import` still guards the one entry.
6. **§6 Verification traps**
   1. **`.focus()` does not match `:focus-visible`** — send a real Tab or assert `el.matches(':focus-visible')`; the `:focus` and `:focus-within` rungs do respond.
   2. **Layer order comes from the `@layer` declaration** — dev and build place blocks differently; verify by the declaration or `getComputedStyle`, never block position.
