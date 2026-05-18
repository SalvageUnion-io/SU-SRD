# Plan — itun-revamp-wave-0

Single cycle. The Wave 0 scope (archive legacy + scaffold new app + wire CI) is one cohesive integration; splitting it into more cycles would be artificial and would produce unmergeable intermediate states (e.g., a half-archived legacy app or a scaffolded new app with the same path as the still-present legacy app).

## Cycle 1: Archive legacy + scaffold new ITUN + wire CI hooks

- **ACs covered**: AC-1, AC-2, AC-3, AC-4, AC-5 (AC-6 is fulfilled by Phase 5 ship)
- **Branch**: `run/2026-05-17-itun-revamp-wave-0/cycle-1`
- **Worktree**: `.worktrees/2026-05-17-itun-revamp-wave-0/cycle-1/`
- **Parent**: `run/2026-05-17-itun-revamp-wave-0/work` @ `0428e1c7`
- **Reads from**: nothing (this is the foundational cycle)
- **File paths (touched)**:
  - `apps/itun-legacy/**` — entire legacy app moved here via `git mv`
  - `apps/in-the-union-now/**` — new greenfield scaffold (Vite + React 19 + TanStack Router/Query + Zustand + ShadCN + Tailwind v4 + Zod)
  - `package.json` — workspace globs already cover `apps/*` so likely no change; verify `dev:itun`/`build:itun` scripts target new path
  - `lefthook.yml` — existing root `*.{ts,tsx,...}` globs already cover the new app; verify no changes needed
  - `bunfig.toml` (root + per-app) — confirm test discovery picks up new app
  - `.gitignore` — append `.worktrees/` if absent (it already is per recent kickoff)

## Dep graph

```
cycle-1 (no dependencies)
```

## Aggregate budget allocation

- 1 cycle planned, 0 remediation cycles expected
- Aggregate budget: 6 (set in manifest; leaves headroom for ≤5 remediation cycles from Phase 4 review)
