# Cycle 1 — Workspace CRUD UI + build assignment (#209)

Branch: `run/2026-05-18-itun-revamp-wave-8/cycle-1`
ACs: AC-1, AC-2
Status: Worker stalled on 600s watchdog after writing implementation files but before committing. Orchestrator salvaged the uncommitted work from the worker's worktree and committed it on this branch.

## Files

- `apps/in-the-union-now/src/components/workspace/WorkspaceList.tsx` — Create/Rename/Delete UI backed by `useWorkspaceStore`
- `apps/in-the-union-now/src/components/workspace/WorkspaceSwitcher.tsx` — Dashboard header dropdown
- `apps/in-the-union-now/src/components/workspace/AssignToWorkspaceButton.tsx` — detail-view assign/unassign affordance
- `apps/in-the-union-now/src/components/workspace/__tests__/*.test.tsx` — 3 component test files
- `apps/in-the-union-now/src/components/dashboard/Dashboard.tsx` (small edit — add WorkspaceSwitcher + filter logic)
- `apps/in-the-union-now/src/routes/{mechs,pilots,crawlers}/$id.tsx` (small edit — add AssignToWorkspaceButton)

## AC coverage

- AC-1: WorkspaceList provides CRUD; WorkspaceSwitcher filters Dashboard
- AC-2: AssignToWorkspaceButton wired into all three detail views

## Orchestrator note

Worker stalled before committing. Files were intact in the worktree as staged/unstaged changes; orchestrator committed them with attribution to both worker (Sonnet) and orchestrator.
