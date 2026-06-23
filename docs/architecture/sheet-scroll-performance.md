# Sheet-Scroll Performance (REQ-NF-03)

**Requirement (REQ-NF-03):** the live sheet must keep scrolling at **60 FPS on
an iPhone-class device**. This is a non-functional performance bar, not a
feature — this doc records (1) why the scroll path is already free of the usual
jank sources, (2) how to measure frame rate to confirm the bar, (3) the pass
criteria + device/throttle profile, and (4) the committed regression guard.

The sheet path is `apps/in-the-union-now/src/components/sheet/`: the shared
shell `LiveSheet.tsx` plus the body slabs `MechSheet.tsx` / `PilotSheet.tsx` /
`CrawlerSheet.tsx`, reached via the route `src/routes/sheet/$kind/$id.tsx`.

---

## Why the scroll path is fast by construction

60 FPS gives the browser a **~16.7 ms budget per frame**. Scroll jank on a
page like this comes from a small, well-known set of causes — each is absent
here:

| Common jank source                                                                               | Status on the ITUN sheet path                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-frame JS in an `onScroll` / scroll listener                                                  | **Absent.** The sticky-bar "condense" is driven by an `IntersectionObserver` with a single threshold (`LiveSheet.tsx` → `useCondensed`), which fires only at the hero-out-of-view transition, not per frame. No `onScroll`, no `addEventListener('scroll')` anywhere on the sheet path. |
| `clamp01` / interpolated scroll math per frame                                                   | **Absent.** The prototype's per-frame clamp01 interpolation was deliberately **not** ported; the only reference to `clamp01` in the sheet code is a comment in `LiveSheet.tsx` explaining the choice.                                                                                   |
| Compositor-thrashing effects (`backdrop-blur` / `backdrop-filter`, `will-change`, `scroll-snap`) | **Absent on the sheet path.** A repo-wide grep finds the only `backdrop-blur` in `WizShell.tsx` (the build wizard), not the sheet. No `will-change`, no `scroll-snap`.                                                                                                                  |
| Layout-forcing style change per frame                                                            | **Absent.** The only condense-driven style change is a `box-shadow` toggle on the **already-sticky** header (`LiveSheet.tsx`), applied **once** at the intersection transition. `box-shadow` is a paint-only property and the toggle is not per-frame.                                  |
| Long / virtualized list re-layout while scrolling                                                | **Not a risk at realistic volumes.** The body renders a bounded, non-virtualized list of slabs sized to **one** entity's loadout (`MechSheet` ~332, `PilotSheet` ~754, `CrawlerSheet` ~622 lines of layout). List length is fixed by a single character's data, not user-scalable.      |

Net: there is **no main-thread work scheduled per scroll frame**. Scrolling is a
compositor-thread operation; the page just moves.

---

## How to measure (methodology)

Two complementary methods. The **manual DevTools run is the canonical 60-FPS
sign-off**; the scripted Playwright probe is the committed regression guard.

### 1. Canonical baseline — Chrome DevTools Performance panel (manual)

This is the run that satisfies the "60 FPS on an iPhone-class device" criterion.
It must be run **interactively** (a headless/sandboxed agent session cannot
launch a throttled, device-emulated Chrome).

1. `bun run dev:itun` and open the app in Chrome (desktop).
2. Build any mech, open its sheet (`/sheet/mech/$id`). A mech sheet has the most
   body slabs, so it is the worst case for scroll cost.
3. Open DevTools → **Device Toolbar** (Cmd/Ctrl+Shift+M) → pick an
   **iPhone-class device** (e.g. _iPhone 12 Pro_). This sets the viewport and
   touch emulation.
4. DevTools → **Performance** panel → gear icon →
   - **CPU: 4× slowdown** (entry-level emulation) or **6× slowdown** (a
     conservative iPhone-class lower bound).
   - **Network:** not relevant to scroll (the sheet is already loaded); leave
     default.
5. Click **Record**, then scroll the full sheet top→bottom→top with the
   trackpad/mouse-wheel over ~3–4 seconds. Stop the recording.
6. Read the result:
   - The **Frames** track / **FPS meter** should sit at/near 60 FPS with **no
     red "dropped frame" bars** during the scroll.
   - The **Main** thread track should show **no long tasks** (≥ 50 ms; flagged
     with a red corner) overlapping the scroll gesture.
   - Frame times should stay at/under the **~16.7 ms** budget.

**Record the device + CPU-throttle profile used and the observed result in the
"Baseline runs" section below.**

### 2. Regression guard — scripted Playwright (Long Tasks)

Committed at `apps/in-the-union-now/e2e/sheet-scroll-perf.e2e.ts` and run by the
existing chromium e2e harness (`bun run e2e:itun`).

It builds a mech, opens its sheet, installs a `PerformanceObserver` for
`longtask` entries (the [Long Tasks API][longtasks] — Chromium-only; the test
self-skips elsewhere), then programmatically scrolls the document
top→bottom→top one frame at a time and **asserts zero long tasks** were recorded
during the gesture.

Rationale: at 60 FPS the per-frame budget is ~16.7 ms; a main-thread **long
task** (≥ 50 ms) landing during scroll is exactly what drops frames. Because the
sheet path schedules no per-frame scroll work, a healthy run sees **zero** long
tasks — so any long task is a real regression (new per-frame scroll JS, a
layout-forcing condense change, etc.) and a signal to re-measure the manual
baseline. This probe does **not** itself emulate an iPhone CPU; it asserts the
_absence of the failure mode_, which is device-independent.

---

## Pass criteria

- **Manual (canonical):** under iPhone-class device emulation + 4×–6× CPU
  throttle, a full scroll of `/sheet/mech/$id` sustains ~60 FPS with **no
  dropped frames** and **no main-thread long tasks** overlapping the scroll;
  frame times stay at/under ~16.7 ms.
- **Scripted (regression guard):** `sheet-scroll-perf.e2e.ts` records **zero**
  `longtask` entries across a programmatic top→bottom→top scroll.

If a measured run shows dropped frames or long tasks, **do not** pre-emptively
refactor — open a separate item against the evidence. The likely levers (only
if needed) are memoizing the sheet body, or wrapping the condense `box-shadow`
in a class toggle that cannot force layout.

---

## Baseline runs

Append one row per measured run (newest first). Capture the manual canonical run
interactively per method 1 above.

| Date      | Build / commit | Method                                            | Device profile             | CPU throttle | Result                            |
| --------- | -------------- | ------------------------------------------------- | -------------------------- | ------------ | --------------------------------- |
| _pending_ | _this PR_      | DevTools Performance (manual) — run interactively | iPhone-class (e.g. 12 Pro) | 4×–6×        | _capture & record (see method 1)_ |

> The scripted guard (`e2e/sheet-scroll-perf.e2e.ts`) runs every CI e2e pass and
> needs no manual entry — it fails loudly if a long task appears.

[longtasks]: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming
