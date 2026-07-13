# Dashboard "Display" — Completion Plan

> **Status:** Planning / remediation record. Scope is the **Display** surface only
> (the single light "forward" content cell of the Dashboard). It compares the
> _intended_ Display against what is _built_ today and lays out a prioritized,
> independently-shippable path to close the gap.
>
> **Authoritative design record:** [`dashboard.md`](dashboard.md) — this plan does
> not restate the locked layout; it inherits §2.2.D (the Display narrative) and §6
> (the component tree) as the contract. Read alongside
> [`display-system.md`](display-system.md) (the `suref-react` render stack the
> Display reuses), [`combat-loop.md`](combat-loop.md) (the play-state model the
> resolve flow drives), and ADRs
> [016](../adrs/ADR-016-dashboard-rotary-dial-instrument-split.md) /
> [017](../adrs/ADR-017-dashboard-reuse-faithful-srd-display.md) /
> [007](../adrs/ADR-007-automation-boundary.md).

---

## 1. What "the Display" is (and is not)

Within the Dashboard grid the **Display** is the bottom-left `pc-display` cell — the
one element that reads "forward" (solid 2.5px border), a **META window that follows
Dial focus** (focus→display sync). In code it is
[`DisplayView.tsx`](../../apps/in-the-union-now/src/components/dashboard/DisplayView.tsx)
(swapped for `DowntimeWizard` while in Downtime).

Note the naming trap flagged in `dashboard.md` §1: `Dashboard.tsx` at route `/` is
the **Roster**, not this surface. The Display is `DisplayView.tsx`; the play-surface
root is `Dashboard.tsx` under `components/dashboard/` routed at `/dashboard/$id`.

**Important framing:** the Dashboard's _instruments_ (RailBar, ActiveItemBand with
its live reactor/damage/critical/meltdown/cargo overlays, Dial, DialConfig,
DashboardChooser, DowntimeWizard, `dashboardRules` engine) are **largely complete
and mutation-wired.** The deviation the redesign set out to deliver — the _faithful
reference document that follows the dial_ — is where the Display has drifted. The
gaps below are almost entirely in **`DisplayView` content**, not the surrounding HUD.

## 2. Intended Display scope (from `dashboard.md` §2.2.D + §6)

```
Display (the one "forward" surface)
├── AtRest (3 content modes):
│   ├── ActionsDeck   ← default: cross-source action grid (mech AND pilot-on-foot,
│   │                    source-spined; drone/ally where present)
│   ├── EntityView    ← real ReferenceEntityDisplay + grouped ReferenceEntityActions
│   │                    + entity-level footActions (Load Into Mech / Enter Downtime /
│   │                    Hand re-roll) + live statsOverride
│   └── TablesRoller  ← RollTable + picker + Roll; [[links]] drill into an entity card
│                        (the one sanctioned internal scroll)
├── ResolveMode:
│   └── ActionResolver ← Activate → Roll → Push → **Apply**
└── Overlays:
    ├── StorageOverlay      ← cargo hold manifest + Jettison
    ├── TablePickerOverlay  ← 5-column grouped picker
    └── DowntimeWizard      ← 10-step guided sequence (downtime state)
```

Plus the SRD-Explorer statless focus (a "reference browser") and, per §2.5, the
three-mode content shift (on-foot parked-mech read-only + **Load CTA in the
display**; boarded pilot-status demotion; downtime step detail + Mark Complete).

## 3. Built vs. intended — the Display gap table

Verified against the current worktree (branched off PR #437).

| Intended Display piece                                                                                                           | Built today                                                                                                                                                                                 | Status                                                   | Evidence                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EntityView** — `ReferenceEntityDisplay` + grouped `ReferenceEntityActions` + entity-level `footActions` + live `statsOverride` | Bare `ReferenceEntityDisplay` card only (chassis for mech, class for pilot); **crawler renders a plain text note, not a card**; no grouped actions, no `footActions`, no live-stat override | **Incomplete (largest gap)**                             | `DisplayView.tsx:96-132`; zero `footActions`/`footMeta`/`statsOverride`/`ReferenceEntityActions`/`EntityHrefProvider` usage anywhere in `components/dashboard/` |
| **ActionsDeck** — cross-source (mech + pilot-on-foot + drone/ally), source-spined                                                | Boarded **mech only** (Chassis/Systems/Modules); on-foot focus still calls `ActionsDeck mech={mech}`; no pilot deck, no drone/ally                                                          | **Partial**                                              | `DisplayView.tsx:84-86`, `ActionsDeck.tsx:38-48`, `buildMechActions` is mech-scoped                                                                             |
| **ActionResolver** — Activate → Roll → Push → **Apply**                                                                          | Activate → Roll → Push; **no Apply step** (roll band shown, not applied)                                                                                                                    | **Partial**                                              | `ActionsDeck.tsx:110-164`; "Apply" exists only in `ActiveItemBand` damage overlays (`:471`, `:640`)                                                             |
| **TablesRoller / TablePickerOverlay** — RollTable + **5-col grouped picker** + `[[links]]` drill-in                              | `RollTable` + a plain alphabetical `<select>`; no grouped picker; `[[links]]` do not drill in-display                                                                                       | **Partial**                                              | `DisplayView.tsx:49-82`; no `EntityHrefProvider` in-display                                                                                                     |
| **SRD Explorer** focus — reference browser                                                                                       | Hard placeholder note                                                                                                                                                                       | **Stub / unbuilt**                                       | `DisplayView.tsx:87-92` ("Interactive content lands in a later phase")                                                                                          |
| **Drone / Ally** entity focuses                                                                                                  | Not built — composition surfaces no drones/allies; Dial builds no drone/ally items                                                                                                          | **Unbuilt**                                              | `composition.ts` has no drone/ally; `dialItems.ts:118-154` builds mech/pilot/crawler only                                                                       |
| StorageOverlay (cargo + Jettison)                                                                                                | Built (lives in `ActiveItemBand` StorageBay)                                                                                                                                                | **Done** (relocated to the band)                         | `ActiveItemBand.tsx` StorageBay                                                                                                                                 |
| DowntimeWizard (10-step)                                                                                                         | Built, driven from `SalvageUnionReference.Guides`                                                                                                                                           | **Done** (economy writes deliberately deferred to sheet) | `DowntimeWizard.tsx`                                                                                                                                            |

**Adjacent (not Display content, but affect it):**

- **Settings menu** (RailBar ⚙) — disabled "planned" stub (`RailBar.tsx:46-48`).
- **Phone reflow** — placeholder message below the scale floor; no `DashboardPhone`
  (`DashboardCanvas.tsx:50-56`). The Display's mobile variant therefore doesn't exist.
- **Stale docstrings** — several file headers still say "Phase 1 read-only shell / no
  mutations yet"; the code is far past that. Cosmetic but misleading.

## 4. Prioritized workstreams

Ordered by user-visible value per unit effort. Each is independently shippable and
testable; each ends green (`bun --filter in-the-union-now test`, `typecheck`, `lint`).

### W1 — EntityView: make the entity focus a real reference document (highest value)

This is the deviation most responsible for the "incomplete form" feel: focusing a
mech/pilot/crawler on the dial should show the **faithful SRD card the rest of the
app shows**, with its grouped actions and entity-level buttons — not a bare chassis
card and a text note.

- Replace the bare `EntityCard` path with `ReferenceEntityDisplay` driven through its
  slot props (per `display-system.md` and `dashboard.md` §3.4):
  - `abilitiesSection` → grouped `ReferenceEntityActions` for the focused entity.
  - `statsOverride` → live play values (`currentHP/SP/EP/Heat`, AP) so the header
    reflects table state, not base stats.
  - `footerOverride` / `afterExtraContent` → entity-level `footActions`:
    **Load Into Mech** (on-foot parked mech), **Enter Downtime** (crawler),
    **Hand re-roll** (pilot) — via `DisplayCard.footActions`, not a new renderer
    (ADR-017; reuse the `Erow`/`ActionCardErow` vocabulary, §3.3).
- Render the **crawler** focus as its real reference card (currently a text note);
  keep the Enter Downtime button as a `footAction`.
- Provide an in-display `EntityHrefProvider` so `[[links]]` drill into the in-display
  entity view rather than navigating away (the one sanctioned internal scroll).
- Touches: `DisplayView.tsx` (+ a small `EntityView` extraction), no new schema.

### W2 — ActionResolver: add the Apply step + on-foot pilot deck

- **Apply step** in `ActionsDeck`: after Roll/Push, resolve the outcome into the
  explicit Apply the spec calls for (Activate → Roll → Push → **Apply**), so a rolled
  action's effect is committed as one bookkeeping write under the ADR-007 boundary
  (auto for non-destructive; the destructive branches already route through
  `ActiveItemBand`'s confirm overlays — reuse, don't duplicate).
- **On-foot deck:** when `mount === 'pilot'`, the Actions focus must render the
  **pilot's** abilities/equipment deck (source-spined orange), not the mech's. Add a
  pilot-sourced `buildActions` sibling to `buildMechActions`; select by mount in
  `DisplayView`.
- Touches: `ActionsDeck.tsx`, `dashboardRules.ts` (`buildMechActions` → add a pilot
  variant), `DisplayView.tsx` dispatch.

### W3 — TablesRoller: grouped picker + link drill-in

- Replace the alphabetical `<select>` with the **5-column grouped picker**
  (`TablePickerOverlay`), grouping the ~96 `RollTables.all()` by app-side categories
  (there is no category field in data — categorize app-side, per §5.6).
- Wire `[[Name]]` links in rendered tables to drill into the in-display entity card
  (shares the W1 `EntityHrefProvider`).
- Touches: `DisplayView.tsx` (+ a `TablePickerOverlay` component).

### W4 — SRD Explorer focus (currently a hard stub)

- Replace the placeholder with a real in-display reference browser: a compact,
  searchable list of SRD entities (reuse `salvageunion-reference` `search()` and the
  same `ReferenceEntityDisplay` W1 uses) that drills into an entity card in place.
- Decision to make first: is SRD Explorer worth a full browser, or should it be
  **folded into W1's EntityView + a search box** (cheaper, one code path)? Recommend
  the latter unless product wants a standalone browser. See §6.
- Touches: `DisplayView.tsx` (`srd` focus branch), possibly a small `SrdExplorer`.

### W5 — Adjacent polish (opportunistic, lower priority)

- RailBar **Settings** menu (Rules & Sources / Dashboard settings / Downtime entry) —
  currently disabled.
- **Phone reflow** (`DashboardPhone`) so the Display has a mobile form — larger effort;
  scope separately (it's a layout project, not Display content).
- Refresh the **stale "Phase 1" docstrings** across `components/dashboard/*` to match
  the shipped reality.
- **Drone / Ally** focuses — blocked on composition surfacing drones/allies (local-first
  data model has no such link today). Treat as its own data-model question, not part of
  Display completion. See §6.

## 5. Sequencing & verification

- **Suggested order:** W1 → W2 → W3 → W4, then W5 as capacity allows. W1 unblocks W3/W4
  (shared `EntityHrefProvider` + reference-card path) and delivers the biggest visible
  jump on its own, so it ships first even if the rest slips.
- **Per-workstream gate:** `bun --filter in-the-union-now test`, `bun run typecheck`,
  `bun run lint`. Extend `__tests__/DisplayView.test.tsx` per mode; keep the
  `e2e/display-verification.e2e.ts` flow green.
- **ADR-007 assertions:** any new Apply/resolve write must be unit-tested to (a)
  auto-apply only non-destructive bookkeeping and (b) route destructive outcomes
  through a confirm/undo — never auto-write a condition (`dashboard.md` §10.1).
- **Ephemeral/persisted split:** new Display state (focus, resolve step) stays in
  `playStateStore`/component state, never `entityStore` or snapshots (ADR-019).
- **Screenshot pass** (outstanding per `dashboard.md` §10.5): once W1 lands, verify
  light/dark contrast on the reference card in the dark HUD and that grouped actions +
  footActions fit the display area without breaking the no-scroll contract.

## 6. Open questions for the user

1. **SRD Explorer** — full standalone browser, or fold into W1's EntityView + a search
   box (recommended, cheaper)?
2. **Drone / Ally focuses** — the spec lists them, but composition/data model surfaces
   no drones/allies today. In scope for "done," or explicitly deferred as a data-model
   change?
3. **Phone reflow (W5)** — is a mobile Display form part of "done," or is
   landscape-desktop-only acceptable for now (it's a separate layout effort)?
4. **Apply semantics (W2)** — should Apply commit rolled action outcomes automatically
   where non-destructive, or always present an explicit confirm even for
   non-destructive effects? (Recommend auto for non-destructive per ADR-007.)

```

```
