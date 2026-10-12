---
status: accepted
---

# ADR-042: Mid-Tab Updates: the Build Floor Moves Only When a Change Breaks an Open Tab

## Status

**Accepted; built** (2026-10-09). Decision 4, the soft update, was added in the same stack.

## Context

ITUN is a PWA that stays open across deploys. The build floor (#1196) retires
a tab whose bundle is older than its backend: the tab stops writing, then
reloads once the Worker serves the new shell. Each deploy wrote its own
commit time into the floor. So every ITUN deploy put every open tab into
"Read-only — updating" for the minutes between the Convex push and the Worker
deploy, and then hard-reloaded it wherever the player was. Most deploys
change nothing an open tab depends on.

The opposite case was not caught at all. ITUN-CONVEX-9 (2026-10-09): #1212
made `entities.upsertByAppId`'s `expectedUpdatedAt` required. A tab opened
before the floor existed sent the old arguments, and the backend refused the
pilot it had just built.

## Decision

1. **The floor is a committed number.** `apps/itun/convex/buildFloor.ts`
   compiles into both the backend (`build.floor`) and every bundle. A tab is
   outdated when the backend's floor is above the one its bundle was built
   with. The deploy no longer writes it, and bundles carry no build stamp.
2. **It is raised by hand, only for a breaking change.** A breaking change is
   one whose backend refuses or misreads what an older tab sends: a deleted
   function, a new required argument, a narrowed validator, or a stored shape
   older code cannot read or would write wrongly. The new value is the
   current time (`date +%s`). It is never lowered.
3. **The `client-contract` gate catches the argument half.** It reads every
   public function's argument validator (`exportArgs()`) and compares it to
   `tools/convex-client-contract.json`. A change that refuses a call the
   snapshot accepted fails unless the floor was raised. A compatible change
   only rewrites the snapshot.
4. **A compatible build is picked up at the next page change.** A tab learns
   a new build is live when its update check installs the new worker
   (`onNeedRefresh`), or when another tab activates it (`onNeedReload`, which
   no longer reloads this tab). From then on, its next in-app navigation to
   another page is a full load of that page (`src/lib/sw/softUpdate.ts`).
   Same-page updates and back/forward stay in-app. Intent preloading stops,
   because an old chunk name would fail and chunk recovery would reload the
   page.

## Consequences

- A compatible deploy leaves every open tab writing. The tab moves onto the
  new build when the player next changes page, and nothing reloads under
  them. A wizard draft survives that load (`lib/wizard/wizardDraft.ts`).
- A tab that never changes page keeps running the build it loaded. That is
  safe, because the floor did not move.
- A breaking deploy behaves as before: open tabs stop writing at once and
  reload onto the new build.
- The gate sees argument validators only. A `v.any()` body whose meaning
  changes (slug-only refs, #1267), a return shape, or new behaviour under the
  same arguments still needs the author to raise the floor.
- Forgetting to raise it for such a change now strands old tabs where every
  deploy used to retire them. The gate covers the common case, and
  `buildFloor.ts` lists what counts.
