---
status: superseded
supersededBy: [41]
---

# ADR-024: Derived, Per-App Release Changelogs for the Sites

**Superseded by [ADR-041](041-deployed-commit-is-release.md)** (2026-10-08). Each site's changelog is still derived from conventional squash titles, but read from `main`'s history at build time and filtered by scope; release-please, its versions, its release PRs and the `CHANGELOG.md` files are gone.

Full text: `git show bc9f08ce:docs/ARCHITECTURE.md` (its `## ADR-024` section)
