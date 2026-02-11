# TTRPG UX Designer - Agent Memory

## Project Structure
- Monorepo at `/Users/jarvis/Code/su-io/SU-SRD/`
- Shared theme: `packages/suref-react/src/theme.ts` (suColors, semantic tokens, Fira Code font)
- Game rules constants: `packages/suref-react/src/constants/gameRules.ts`
- Builder live sheet: `apps/suref-builder/src/components/NewPilotLiveSheet/`
- Builder uses NumericStepper, Card (from suref-react), PilotResourceSteppers pattern
- See `patterns.md` for component details

## Theme & Color Notes
- Entity colors: orange=pilot, green=mech, pink=crawler
- GREEN (122,151,138) and PINK (206,88,152) FAIL WCAG AA contrast on both light/dark backgrounds
- Use these as accents/borders only, not for text. See `itun-ux-review` for full contrast analysis
- Heat colors need NEW tokens: critical red (200,50,50), atCap red (180,30,30)
- Roll tier colors: cascadeFailure=deep red, failure=rust, toughChoice=amber, success=green, nailedIt=blue

## ITUN UX Review (Feb 2025)
- Full review written to `.claude/plans/resilient-strolling-matsumoto-agent-af5c81a.md`
- Key issues: sticky header too tall on mobile (needs auto-collapse), actions tab should filter by action type not source, 3-col grids need responsive breakpoints, needs FAB for d20 roll, condition cycling needs undo protection
- Recommended: collapsible sticky header, action-type filter chips, responsive 1/2/3-col grid, floating d20 FAB, segmented control for conditions

## Existing Patterns (Builder)
- `Card` component in suref-react: flexible header/body with bg, source styling, compact mode
- `getTiltRotation()` in suref-react for damaged item visual treatment
- `EntityDisplay` render prop pattern for app-specific renderers
- `NumericStepper` in builder (not shared) - needs 44px touch targets for mobile
- Actions tab uses `useUniversalActions` hook, splits into 2-col Grid on desktop
- Resource steppers use optimistic mutation via TanStack Query `useMutation`
