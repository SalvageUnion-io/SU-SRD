# ITUN Design Review — Findings Report

_Deep agentic review, 2026-07-01. Four parallel review dimensions: SRD parity, tidiness/uniformity, rules utility (vs. Salvage Union Digital Edition 1.2 + Quick Ref 2.0 extracts), and UX/visual design. No changes made — worktree `itun-design-review` is clean and ready for implementation._

---

## Executive summary

ITUN is structurally healthy — the `LiveSheet`/`SheetHero` shell, the wizard's three-pane `WizShell`, the semantic token system, and the ADR-007 automation pattern (exemplified by `HeatCheckControl`) are all strong and should not be touched. The recent token-unification pass (#329) already closed most of the _style_ gap with the SRD site.

What's holding ITUN back is different in each of your four goals:

1. **SRD matching** — the gap is now _chrome and capability_, not styling: ITUN has none of the SRD's brand header, no reference search, and inconsistent cross-linking.
2. **Tidiness** — a layer of local duplication under the shared components: a competing local Button, copy-pasted dialogs, hand-rolled modals, and hardcoded pixel values in ITUN-local components.
3. **Rules utility** — the heat loop is fully automated, but the three most table-painful mechanics are not: damage intake (with crit tables), the downtime procedure, and the salvage rollers. All the plumbing (pure functions, data tables, cargo lots, TL pools) already exists.
4. **Modern look** — loading states are bare text, heat never escalates visually, roll-result color tokens sit unused, and relationship links aren't clickable.

The highest-leverage observation across all four reviews: **the patterns needed to fix everything already exist in the codebase** — `HeatCheckControl` is the template for every missing roll prompt, `SearchIsland` is 269 reusable lines, `applySpDamage` is written but unused, and the roll-table data ships in the reference package (currently only the Discord bot rolls it).

---

## 1. Match the SRD — parity findings

### Already aligned (verified, no action)

Entity rendering (both apps use `ReferenceEntityDisplay` with the same mode system), trait/keyword tooltips (`TraitKeywordDisplayView`), tech-level colors, status badges, pseudoheaders, grid stability, and color tokens (post-#329). Typography is aligned _within shared components_.

### Intentional divergences (keep)

- **Detail navigation**: srd opens details in a new tab (#332); ITUN keeps the modal. Correct for a builder — context preservation matters mid-edit.
- **Interactive roll tables**: ITUN's `RollTableButton` adds interactivity the read-only SRD doesn't need.

### Gaps to close

| #   | Finding                            | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Files                                                                                                                        |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| P-1 | **No brand chrome**                | SRD's signature header (`bg-su-ink-dark`, 3px `su-orange-dark` bottom border, SU mark, `font-cond` wordmark) is absent. `__root.tsx` renders a bare `<Outlet/>`; the dashboard invents its own plaintext `ITUN [Beta] — Saved Builds` h1. **Design decision needed**: render a shared `AppHeader` on dashboard/wizard/detail routes but suppress it on `/sheet/*` (the sheet's sticky bar is its chrome — a global header would double-stack), or fold a small SU mark into the sheet bar. | `src/routes/__root.tsx`, new `src/components/shared/AppHeader.tsx`; brand ref: `apps/srd/src/components/TopNavigation.astro` |
| P-2 | **No reference search**            | srd has Cmd+K in-memory search with keyboard nav; ITUN has zero discoverability — users drill menus or leave the app. The `search()` function is in the reference package and srd's `SearchIsland` (269 lines) is largely portable.                                                                                                                                                                                                                                                        | `apps/srd/src/components/islands/SearchIsland.tsx` → new ITUN search                                                         |
| P-3 | **Inconsistent SRD cross-linking** | `ViewInSRDLink` ("View in SRD →") exists but appears only on some entities. Pick a strategy: make it ubiquitous on major entity cards, or rely on the detail modal.                                                                                                                                                                                                                                                                                                                        | `src/components/contextual/ViewInSRDLink.tsx`, `src/lib/srd-deep-link.ts`                                                    |
| P-4 | **Error/404 states off-brand**     | `RootErrorComponent` and `SheetKindNotFound` use generic `text-lg font-bold`/`bg-primary` instead of the `font-cond uppercase` + `Slab`/`Btn` vocabulary.                                                                                                                                                                                                                                                                                                                                  | `src/routes/__root.tsx`, `src/routes/sheet/$kind/$id.tsx`                                                                    |

---

## 2. Tidy and uniform — internal consistency findings

| #   | Finding                                                         | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Effort  |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| T-1 | **Duplicate Button component**                                  | `src/components/ui/button.tsx` (variants `default/outline/ghost/secondary/destructive/link`) competes with component-lib's `Btn` (`primary/ghost/danger`, used in 30+ places). Only 5 consumers: `ExportEntityButton`, `SoftWarningBanner`, `UnassignLinkButton`, `AssignPilotToMech`, `AssignCrawlerToPilot`. Delete local Button + `buttonVariants.ts`, migrate to `Btn` (extend Btn's variants in component-lib if needed).                                                                               | Low     |
| T-2 | **Copy-pasted assign dialogs**                                  | `AssignPilotToMech.tsx` and `AssignCrawlerToPilot.tsx` are ~195 lines each and 99% identical (selector dialog + confirm flow). Factor into a `GenericSelectorDialog<T>`; kills ~150 duplicated lines.                                                                                                                                                                                                                                                                                                        | Medium  |
| T-3 | **Seven hand-rolled dialogs; `ModalShell` unused**              | AssignPilotToMech, AssignCrawlerToPilot, UnassignLinkButton, DeleteConfirmDialog, WorkspaceList, SavePatternButton, WorkspaceSwitcher each build their own `role="dialog"` + `useDialogA11y`, with inconsistent styling (theme-aware `border-ink bg-paper` vs generic `rounded-lg bg-background shadow-lg`; backdrop `bg-black/50` vs `/60`; `max-w-sm` vs `max-w-md`). component-lib exports `ModalShell` but ITUN never imports it. Standardize on ModalShell (or one ITUN ConfirmDialog wrapper over it). | Medium  |
| T-4 | **Residual generic-Tailwind color vocab**                       | Post-#329 most files use theme tokens, but the `wiring/` components and a few others still use `bg-background`/`text-muted-foreground`/`text-foreground`. Finish the sweep; consider a lint rule banning bare color classes.                                                                                                                                                                                                                                                                                 | Low–Med |
| T-5 | **Hardcoded pixel typography/spacing in ITUN-local components** | `text-[10.5px]`, `text-[7px]`, `tracking-[0.12em]`, `border-[1.5px]`, `px-[26px]`, one-off shadows, magic rail widths (`lg:w-[196px]`, `sm:grid-cols-[1fr_152px]`) scattered across 39+ files (`Sheet.tsx`, `Erow.tsx`, `StorageManifest.tsx`, `WizShell.tsx`, …). Shared components are fine; the drift is ITUN-local. Extract a small semantic scale (label/caption/tiny + tracking steps + border widths) and a `LAYOUT` constants module for rail widths.                                                | Medium  |
| T-6 | **God components**                                              | `Sheet.tsx` (784 lines), `PilotSheet.tsx` (754), `CrawlerSheet.tsx` (622), `ShareSnapshotScreen.tsx` (500) mix view-model derivation, rendering, and action handlers. Extract derived-stat/choice-resolution hooks and per-section sub-components. Do this _opportunistically_ as rules features touch these files — not as a big-bang refactor.                                                                                                                                                             | High    |
| T-7 | **46+ direct store subscriptions**                              | Components mix `useEntityStore((s) => …)` and `useEntityStore.getState()` with no query-hook layer. A `src/hooks/queries/` layer (`usePilots()` etc.) would centralize selectors. Lower priority — the store API is stable.                                                                                                                                                                                                                                                                                  | High    |

---

## 3. Maximum rules utility — gap analysis vs. the core book

### Already excellent

- **Heat loop** (pp. 233–236): activation heat, cap clamp, Heat Check d20, all five Reactor Overload bands, Push, shutdown/vulnerable flags, auto SP damage. `HeatCheckControl.tsx` + `lib/rules/heatCheck.ts` is the best subsystem in the app and the **template for everything below**.
- Activation economy (EP/AP/Uses), item conditions + field repair at half SV, pilot injuries → derived max HP, cargo/inventory with SCRAP-lot TL bucketing, party scrap/upgrade pools, crawler bays with named 4-HP crew NPCs, advancement bookkeeping with soft-warning prerequisites, snapshot sharing.

### The ranked gap backlog (frequency × hand-tracking pain)

| Rank | Gap                                                                      | Rules                    | What's needed                                                                                                                                                                                                                                                                                                      | What already exists                                                                                                                                             |
| ---- | ------------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1  | **Take-Damage control + Critical Damage / Critical Injury roll prompts** | pp. 239–242              | "Take Damage" on mech/pilot sheets: enter N, SP↔HP conversion, Vulnerable ×2; on 0 SP / 0 HP, a roll prompt in the `HeatCheckControl` style (auto-record, player marks the destroyed item / injury lands in the `injuries` schema). Happens multiple times per combat; the most error-prone live math in the game. | `applySpDamage` in `packages/salvageunion-reference/lib/combatUtils.ts` — **written, unused**. `docs/architecture/combat-loop.md` lists this as the known hole. |
| R-2  | **Downtime runner**                                                      | pp. 227–228              | One-click workspace-scoped checklist: restore SP/HP → repair → heal per Med Bay TL (respect bay damage) → +1 TP → recharge uses → clear once-per-rest flags → prompt Upkeep. Today: ~8 manual edits across 3 sheets, every session.                                                                                | Every individual field/reset already exists; this is pure orchestration.                                                                                        |
| R-3  | **Salvage rollers (Area + Mech Salvage) feeding cargo**                  | pp. 245–247              | In-app Area Salvage roller (Supply-limited attempts → deposit results as lots/scrap) and Mech Salvage on a wreck (pick chassis → roll → Damaged chassis/system/module or half-SV scrap into the hold). _This is the game's title loop_ and currently requires the Discord bot + hand-copying.                      | Tables ship in `data/roll-tables.json`; all cargo/lot/TL plumbing done; `@randsum/roller` already a dependency.                                                 |
| R-4  | **Crawler economy actions**                                              | markers 218–223          | "Pay Upkeep" (deduct 5×TL → credit upgrade pool; failed-upkeep deterioration roll), "Upgrade Crawler" (consume pool, bump TL), fixed-rate TL scrap converter (4×T1→1×T4 — pure arithmetic, pure annoyance), Trading Bay availability roll gated on bay condition.                                                  | Pools, `tierUpgradeCost`, `scrapCostFor` all in `lib/rules/scrap.ts`; lozenges render read-only today (`Sheet.tsx:661`).                                        |
| R-5  | **Encounter/NPC tray + Mediator tables**                                 | quick ref; core ~p. 253+ | Local GM tray: add reference NPCs, tick HP/conditions, roll Reaction/Morale/Retreat. High leverage for the "game manager" positioning, zero backend.                                                                                                                                                               | `npcs/squads/creatures/bio-titans/vehicles/meld.json` all ship locally; crawler-bay NPC widgets (`NpcInset.tsx`, `CrawlerNpcStateSchema`) prove the pattern.    |
| R-6  | **Core Mechanic d20 + Group Initiative**                                 | pp. 229–232              | d20 quick-roll with band labels (20 Nailed It / 11–19 Success / 6–10 Tough Choice / 2–5 Failure / 1 Cascade), Push wired to the existing heat path. Value is the band text + push bookkeeping, not the RNG.                                                                                                        | The `--color-roll-cascade/failure/tough/success/nailed` tokens exist in `theme.css`, **unused**. Converges with UX finding U-3.                                 |
| R-7  | **Crafting Bay flow / scrap-a-mech helper**                              | marker 223               | "Craft" on the crawler sheet (pick ≤ crawler-TL item, deduct pool, add to storage); retire-a-mech → half-SV scrap.                                                                                                                                                                                                 | Pool math done.                                                                                                                                                 |

Explicitly out of scope by design (ADR-001 honor system, ADR-007 automation boundary, local-first): turn enforcement, multi-user sync, anything needing a backend.

---

## 4. Modern look and feel — UX findings

The reviewer's structural verdict: leave `LiveSheet`/`SheetHero`, the hero↔strip lockstep, the mobile segmented switch, and `WizShell` alone — the gaps are **chrome, escalation, loading, and rolling**, not architecture.

| #   | Finding                                 | Detail                                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U-1 | **Heat never escalates visually**       | `PIP_FILL.heat` is the same static orange at 1/10 and 10/10. Heat is the game's core tension mechanic. Add thresholds in `StatBlock`/`MiniStat`: ≥~70% cap → top pips go `status-bad` red; at cap → red border + subtle pulse; escalate the "Push (+2 Heat)" button toward destructive styling as heat climbs. Shared-component change — verify srd (inert there without a max). |
| U-2 | **Bare-text loading states**            | `GameDataReady` gates the whole app behind `Loading reference data…`; Dashboard shows `Loading…`. Brand the fallback (SU mark on `su-ink-dark`) and give Dashboard/sheets shimmer skeletons (Dashboard already reserves `min-h-[60vh]`).                                                                                                                                         |
| U-3 | **No d20 quick-roll FAB**               | Thumb-zone FAB on live sheets rolling the action table, result colored by tier with the unused roll tokens. Same feature as R-6 — the two reviews converged on it independently. Needs a small spec first (where results log; snapshot inclusion).                                                                                                                               |
| U-4 | **Dashboard cross-links not clickable** | Pilot↔mech↔crawler relationships render as plain text `↳ Iron Fist` in `EntityListItem`. For a game manager these are primary — make each a link to the entity's sheet. Trivial, high payoff.                                                                                                                                                                                    |
| U-5 | **Mobile sticky-bar clutter**           | At 390px the condensed sheet bar carries back-link + name + status + 4 MiniStats + WiredToggle + Edit + Share + segmented switch. Prioritize Heat+SP MiniStats, collapse Edit/Share into a `⋯` overflow. Regression-test the condense observer.                                                                                                                                  |
| U-6 | **Small polish**                        | Toast-with-Undo when condition cycling lands on `destroyed` (mis-tap mid-combat is jarring); full-width primary CTA on all mobile wizard steps, not just `ctaFullWidth` ones; entity-tone lucide glyphs on `Empty`/`RailEmpty` states.                                                                                                                                           |

---

## Proposed roadmap

Sequenced so each phase is independently shippable and the tidiness work lands _before_ the features that would otherwise copy the mess.

**Phase 1 — Foundation & quick wins** (mostly Low effort, high polish-per-token)

- T-1 delete local Button → `Btn`; T-4 finish token sweep in `wiring/`
- T-3 adopt `ModalShell` / shared ConfirmDialog (fold T-2's `GenericSelectorDialog` into this)
- U-1 heat escalation; U-2 branded loaders/skeletons; U-4 clickable cross-links; P-4 on-brand error states

**Phase 2 — SRD parity chrome**

- P-1 `AppHeader` (needs the suppress-on-`/sheet/*` decision)
- P-2 reference search (port `SearchIsland`)
- P-3 cross-link strategy

**Phase 3 — Rules utility, combat first**

- R-1 Take-Damage + crit-table prompts (wire up `applySpDamage`; extract sheet sub-components as you touch them, per T-6)
- R-6/U-3 d20 quick-roll FAB
- U-5 mobile sticky-bar overflow

**Phase 4 — Rules utility, session loop**

- R-2 Downtime runner
- R-3 Salvage rollers
- R-4 crawler economy actions

**Phase 5 — GM tools & long tail**

- R-5 NPC/encounter tray; R-7 crafting flow; T-5 typography scale; T-7 query-hook layer

---

## What NOT to change (explicitly blessed)

- `LiveSheet`/`SheetHero` architecture and the store-backed hero↔strip lockstep
- `WizShell` three-pane wizard pattern
- The semantic token system and design-spec § discipline
- ITUN's modal detail navigation (correct divergence from srd's new-tab)
- The ADR-007 automation boundary — every new roll prompt should follow the `HeatCheckControl` pattern: auto-apply bookkeeping, player narrates/marks destruction
