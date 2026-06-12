# ITUN Revamp

Greenfield rebuild of `apps/in-the-union-now/`. Tracked end-to-end on the
[ITUN Revamp project board](https://github.com/orgs/SalvageUnion-io/projects/2)
and via pinned tracking epic
[#228](https://github.com/SalvageUnion-io/SU-SRD/issues/228).

## Branch convention

> **`yitun-revamp` is the permanent integration branch for the ITUN revamp.
> All revamp PRs target `yitun-revamp`, never `main` — through M1, M2, M3,
> M4, and any follow-on work. `yitun-revamp` is not closed at the M3
> release; it stays alive as the long-lived home for the rebuild lineage.**

| Phase                       | Story branches off             | PR base                             |
| :-------------------------- | :----------------------------- | :---------------------------------- |
| M1 (Foundation)             | `yitun-revamp`                 | `yitun-revamp`                      |
| M2 (Sheet, Print, Snapshot) | `yitun-revamp`                 | `yitun-revamp`                      |
| M3 (Polish, A11y, Launch)   | `yitun-revamp`                 | `yitun-revamp`                      |
| M3 → Release                | `yitun-revamp` (entire branch) | `main` (one-time integration merge) |
| M4 (Post-Release Backlog)   | `yitun-revamp`                 | `yitun-revamp`                      |

**Every wave stays on `yitun-revamp` — through M3 release, M4 backlog, and any follow-on work afterward.** The integration branch is permanent. `yitun-revamp → main` happens only at the maintainer's discretion (e.g., a coordinated swap when the rebuild is judged production-equivalent); short of that explicit decision, all ITUN-revamp work continues on `yitun-revamp` indefinitely.

The repo's GitHub default branch stays `main` because unrelated work — the
Discord bot, suref-web cleanup, salvageunion-reference data edits, etc. —
continues to target `main`. PRs for this project must pass
`gh pr create --base yitun-revamp ...` explicitly.

## Recommended local workflow

```bash
git switch yitun-revamp
git pull --rebase origin yitun-revamp

git switch -c yitun/<short-slug>          # e.g. yitun/m1-pilot-wizard
# … work, commit, push …

gh pr create --base yitun-revamp \
  --title 'feat(itun): <short summary>' \
  --body  '<see template>'
```

Use conventional-commit prefixes (`feat:`, `fix:`, `chore:`, `refactor:`,
`test:`, `docs:`, `perf:`) on commits and PR titles.

## Milestone gates

Gate-out criteria:

| Gate          | Trigger                                                                                                                                                                                                     |
| :------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 → M2       | All M1 DoD pass; `bun run check:all` green; manual end-to-end build + save + load for all three entity types.                                                                                               |
| M2 → M3       | All M2 DoD pass; print output reviewed by maintainer on A4 + US Letter; snapshot publish + open round-trip passes for all four composition modes.                                                           |
| M3 → Release  | All M3 DoD pass; `a11y-scan` CI reports zero WCAG 2.1 AAA violations on sheet view + zero AA violations elsewhere; maintainer completes fresh pilot + mech + crawler build without consulting the codebase. |
| M4 (optional) | Post-release; driven by maintainer availability.                                                                                                                                                            |

## Story tracker

See pinned epic [#228](https://github.com/SalvageUnion-io/SU-SRD/issues/228)
for the canonical list of all 45 stories with their milestone, label, and DoD.

## Notes for future Claude / agent sessions

- Always confirm `git branch --show-current` is `yitun-revamp` (or a `yitun/*`
  branch) before opening an ITUN-revamp PR.
- Pass `--base yitun-revamp` to `gh pr create`. The repo default is `main`.
- Memory:
  [`feedback_itun_revamp_branch.md`](file:///Users/jarvis/.claude/projects/-Users-jarvis-Code-su-io-SU-SRD/memory/feedback_itun_revamp_branch.md)
  captures this convention for future sessions on this machine.
