# TTRPG UX Designer - Agent Memory

## Project Structure

- Monorepo at `/Users/jarvis/Code/su-io/SU-SRD/`
- Architecture docs: `docs/architecture/` (display-system, data-flow, seo-accessibility, package-contracts)
- Shared theme: `packages/component-lib/src/styles/theme.css` (CSS custom properties, Fira Code font)
- Game data: `packages/salvageunion-reference/` (ORM-like API, `SalvageUnionReference.get(schemaName, id)`)
- ITUN app: `apps/itun/` (React 19 + TanStack Router/Query + ShadCN + Tailwind v4)

## Dataviz Idioms (pips/tracks/roll readouts)

See [dataviz-idioms.md](dataviz-idioms.md) — pip magnitude consistency, the UNIFIED over-capacity red idiom (StatBlock/MiniStat/BudgetTrack/StorageManifest), heat escalation, roll-result severity colouring (band colours are QuickRollFab-only; table rolls colour by outcome severity), TL colour scale usage.

## Three-Layer Display System

1. **Card** (`packages/component-lib/src/components/shared/Card.tsx`): Low-level card with two boolean props (`compact` for reduced spacing, `listing` for header-only), controls architecture, stats system (StatsBar), tabs, sticky headers
2. **ReferenceEntityDisplay** (`packages/component-lib/src/components/referenceEntity/`): Entity renderer with generic slot props (titleOverride, subtitleExtra, statsOverride, abilitiesSection, afterExtraContent, footerOverride). Uses data-shape detection, not schema-name checks.
3. **Consumer hooks**: Return slot props to spread onto ReferenceEntityDisplay (e.g., `useChassisPatternConfig`)

## Key Shared Components

- `Card` — Card primitive (replaces old Card component)
- `ReferenceEntityDisplay` — Entity renderer (replaces old EntityDisplay)
- `FilterChip` — Toggle chip with `aria-pressed`
- `StatsBar` / `StatDisplay` / `StatControl` — Stats rendering (read-only or interactive)
- `ValueDisplay` — Labeled value display
- `Text` — Base typography component
- `ControlButtons` — Renders `ReferenceEntityControl[]` array
- Control presets: `addControl`, `deleteControl`, `navigateControl`, `selectControl`

## UI Framework (ITUN)

- **ShadCN + Tailwind v4 + Radix** (NOT Chakra)
- ShadCN primitives in `src/components/ui/`
- Custom theme via CSS variables in `src/index.css` `@theme` block
- State: Zustand (auth only) + TanStack Query (all entity data)

## Theme & Color Notes

- Entity colors: orange=pilot, green=mech, pink=crawler
- GREEN (122,151,138) and PINK (206,88,152) used as accents/borders only, not for text (WCAG AA)
- `su-orange-dark` (168, 82, 34) provides 5.5:1 contrast ratio for text
- Heat colors need NEW tokens: critical red (200,50,50), atCap red (180,30,30)
- Expansion source theming: claw-scratch, beveled border, rain-streak, CRT scanlines

## ITUN UX Review (Feb 2025 — historical)

- Key issues: sticky header too tall on mobile (needs auto-collapse), actions tab should filter by action type not source, 3-col grids need responsive breakpoints, needs FAB for d20 roll, condition cycling needs undo protection
- Recommended: collapsible sticky header, action-type filter chips, responsive 1/2/3-col grid, floating d20 FAB, segmented control for conditions

## ITUN UX Review (2026-07 — current state, post design-spec rebuild)

App is now built on a rigorous internal "design-spec" (§ references in every component). Mature & tidy. Key remaining gaps:

- NO global app chrome/brand header. `__root.tsx` renders bare `<Outlet/>` + Toaster. Dashboard invents its own plaintext "ITUN Beta — Saved Builds" h1. SRD site's branded dark header (TopNavigation.astro: su-ink-dark ground + 3px su-orange-dark bottom border + SU mark + wordmark) is NOT mirrored. Biggest SRD-consistency gap. But live sheets (`Sheet.tsx`/`LiveSheet.tsx`) already have a sticky top bar at top:0 → a global header would double-stack; suppress global header on `/sheet/*` or let the sheet bar carry the brand.
- Heat has NO escalating urgency. StatBlock/MiniStat heat pips are always `status-warn` orange regardless of value/max (pip fill = which-stat, not danger-level). Heat is the dramatic mechanic — needs red escalation near cap (the critical/atCap red tokens flagged above still unused).
- Loading = plain text, not skeletons. `GameDataReady` gates WHOLE app behind one Suspense showing "Loading reference data…"; Dashboard shows "Loading…". No branded skeletons.
- Still no in-app d20 roller (only Heat Check automation + char-gen roll tables). `--color-roll-*` tier tokens (cascade/failure/tough/success/nailed) exist but are unused in sheet UI — ready for a roll FAB.
- Dashboard '↳ Name' cross-links (pilot↔mech↔crawler) are plain text in row meta, NOT navigable.
- Shell files: `components/sheet/LiveSheet.tsx` (sticky condense bar, IntersectionObserver, mobile segmented switch), `SheetHero.tsx` (entity-card-writ-large), `Sheet.tsx` (variant dispatch). Wizards share `components/wizard/WizShell.tsx` (196px stepper rail + optional 320px option pane + floating bottom-right CTA pill). All three wizards (Pilot/Mech/Crawler) reuse it.

## ITUN Dialog / Roll-Prompt Family Templates (verified on itun-design-review branch, Jul 2026 — NOT yet on main)

Two canonical templates every new ITUN surface should match:

- **Dialog family** = component-lib `ModalShell` (base-ui Dialog, backdrop `bg-black/80`, Card pseudoheader, close top-right). ITUN wrappers: `shared/ConfirmDialog.tsx` (body `flex flex-col gap-4 bg-paper p-5`, action row `flex justify-end gap-2`, ghost Cancel + primary/danger confirm, headerBg su-orange / su-rust danger) and `shared/SelectorDialog.tsx` (radio pick-one). Downtime/Crafting/ScrapMech/CrawlerEconomy/GlobalSearch route through ModalShell.
- **Roll-prompt family** = `sheet/HeatCheckControl.tsx`: `<Slab label>` header, `Btn size="sm"` primary/danger, readout `<p role="status" className="font-body text-sm text-ink">`, advisory `<p role="alert" className="mt-2 rounded-[3px] border-chrome border-status-warn bg-paper px-3 py-2 ... text-rust">`, flags `font-cond text-xs font-bold uppercase text-status-bad/text-rust` + MiniBtn Clear. TakeDamage/PilotTakeDamage/Salvage-ClaimPicker/QuickRollFab-pushNote conform.
- **Popover chrome** (non-modal): QuickRollFab + SheetActionsMenu share `z-30 rounded-[6px] border-2 border-ink bg-paper shadow-[0_14px_28px_-14px_rgba(40,32,25,0.55)]` + `shared/useDismiss.ts`.

## component-lib chrome primitives (confirmed)

- `Btn` variants = `default` (paper/ink base — the CVA defaultVariant), `primary` (rust), `ghost`, `danger`; sizes sm/md/lg. `btnVariants` cva exported. `MiniBtn`/`StepBtn` in SmallButtons.
- `Slab` = dashed-leader uppercase section header (NOT a black bar), `tracking-[0.12em]`, tone-deep color, optional `count`.
- `Panel` = plain `rounded-[6px] border-[1.5px] bg-paper` (NO head bar). `Row`, `Empty` (has `icon` slot for entity-tone glyph) same file.
- **Black-bar-card idiom** ("ink head bar over paper body") has NO shared component — hand-inlined in SalvageControl, CraftingControl, StorageManifest, NpcInset, EncounterScreen.Section, EncounterNpcCard with weight drift (border-2 vs border-chrome, px-3 vs px-2). Extraction candidate.
- **Roll-tier badge text convention** (`shared/ConditionToggle.tsx`): white text on saturated fills — bg-roll-success→text-white, bg-roll-cascade→text-white, bg-roll-failure(amber)→text-su-black. Tokens: cascade=red, failure=orange, tough=amber, success=green, nailed=blue. QuickRollFab band chip diverges (text-ink on all fills — contrast risk on red/green/blue).

## Accessibility Patterns

- `eslint-plugin-jsx-a11y` in all ESLint configs
- `tools/a11y-scan.ts` (puppeteer + axe-core) for runtime scanning
- Card: `role="button"` + `tabIndex={0}` when clickable, Enter/Space keydown
- Tab panels: `role="tablist"` / `role="tab"` / `aria-selected`
- Search: ARIA combobox with `aria-activedescendant`
- Mobile touch targets: 44x44px min via `@media (pointer: coarse)`

## Data Flow (ITUN)

- `entity_refs` table bridges player data to game data (schema_name + schema_ref_id)
- Hydration: `SalvageUnionReference.get(ref.schema_name, ref.schema_ref_id)` at query time
- TanStack Query: 5min staleTime, hierarchical query key factories, optimistic updates
- Realtime: `useRealtimeSubscription` invalidates TanStack Query caches on DB changes
