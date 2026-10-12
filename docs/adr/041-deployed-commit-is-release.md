---
status: accepted
---

# ADR-041: The Deployed Commit Is the Release; Changelogs Read `main`'s History

## Status

**Accepted; built** (2026-10-08, audit-4 P17, #1138). Supersedes
[ADR-024](024-derived-release-changelogs.md).

## Context

[ADR-024](024-derived-release-changelogs.md) derived each site's changelog from conventional squash
titles through release-please. By audit 4 that machinery cost more than the
changelog it produced. In the 30 days to 2026-10-08, 16 of 112 commits on
`main` were release commits, and 14 of the 16 release PRs merged within about
two minutes of opening: nobody curated them. Each one bumped
`apps/itun/package.json`, so each redeployed ITUN and pushed Convex for a
version string only ITUN's About page read. The stream also leaked: release-please
attributes a commit to every component whose files it touches, so the SRD's
changelog listed `feat(itun)` entries. Keeping it ran on a PAT in the
`production` Environment and a 108-line parser for release-please's markdown.

Nothing else consumed a version. Sentry tags every event with the deployed SHA
(`VITE_COMMIT_REF`, `SENTRY_RELEASE`), the deploy record is the
`deployed/cloudflare` tag, and a rollback dispatches a SHA.

## Decision

1. **The deployed commit is the release.** No app carries a version
   (`package.json` says `0.0.0`); ITUN's About page shows the build's short
   SHA (`VITE_COMMIT_REF`).
2. **Each site's changelog is `main`'s history, read at build time.**
   `readChangelog(scope, area)` (`packages/component-lib/src/changelog/gitChangelog.ts`,
   the `component-lib/changelog/git` export) runs `git log --first-parent` and
   keeps `feat`, `fix` and `perf` subjects whose scope is the app's own, one
   entry per day with each PR linked. srd calls it during its SSR pass; ITUN's
   `vite.config.ts` inlines the result as `__ITUN_CHANGELOG__`.
3. **The scope is the filter.** `feat(itun): …` appears on ITUN's page and
   nowhere else; `feat(srd): …` on the SRD's; `feat(itun,srd): …` on
   both. An unscoped title, or a package scope, appears on neither.

## Consequences

- No release PRs, no release commits, no PAT: `RELEASE_PLEASE_TOKEN` is no
  longer declared in `tools/environments.ts`.
- The deploy's build jobs check out full history (`fetch-depth: 0`). A shallow
  clone (CI, e2e) renders a shorter changelog, never a failed build.
- A site's changelog is as current as its last deploy. A scoped title that
  touched none of that app's deploy paths shows on the next deploy that does.
- A change to a site has to say so in its title. The PR title gate already
  requires a conventional title; it cannot know the right scope.
