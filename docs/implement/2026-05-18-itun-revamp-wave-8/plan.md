# Plan — itun-revamp-wave-8 (M3 begins)

3 file-disjoint parallel cycles.

## Cycle-1 (Track A): Workspace CRUD UI (#209)
Files (NEW or small EDIT):
- `apps/in-the-union-now/src/components/workspace/WorkspaceList.tsx` — Create/Rename/Delete actions
- `apps/in-the-union-now/src/components/workspace/WorkspaceSwitcher.tsx` — Dashboard control
- `apps/in-the-union-now/src/components/workspace/AssignToWorkspaceButton.tsx` — Detail-view affordance
- `apps/in-the-union-now/src/components/workspace/__tests__/*.test.tsx`
- `apps/in-the-union-now/src/components/dashboard/Dashboard.tsx` (small EDIT — wire WorkspaceSwitcher + filter list by active workspace)
- `apps/in-the-union-now/src/routes/{mechs,pilots,crawlers}/$id.tsx` (small EDIT — add AssignToWorkspaceButton)

## Cycle-2 (Track B): Contextual entity displays (#210)
Files (NEW or small EDIT):
- `apps/in-the-union-now/src/components/contextual/EntityDisplay.tsx` — wrapper around suref-react's EntityDisplay if available, else minimal app-local fallback
- `apps/in-the-union-now/src/components/contextual/__tests__/EntityDisplay.test.tsx`
- `apps/in-the-union-now/src/components/{pilot,mech,crawler}/` — small EDIT to selector components to render EntityDisplay on hover/select

## Cycle-3 (Track C): Deep-links to suref-web (#211)
Files (NEW):
- `apps/in-the-union-now/src/lib/suref-web-deep-link.ts` — URL builder
- `apps/in-the-union-now/src/lib/__tests__/suref-web-deep-link.test.ts`
- `apps/in-the-union-now/src/components/contextual/ViewInSRDLink.tsx` — small Link component wrapping the URL builder
- Small additions to cycle-2's EntityDisplay to render the link (post-merge if cycle-2 lands first; cycle-3 includes a standalone test for the URL builder regardless)

## Dep graph

cycle-1 / cycle-2 / cycle-3 all independent. Cycle-3 ships the URL builder + Link component as standalone units even if cycle-2's EntityDisplay isn't ready at integrate time. Cycle-2 references ViewInSRDLink only via lazy import / consumer composition.

Budget: 10, planned 3.
