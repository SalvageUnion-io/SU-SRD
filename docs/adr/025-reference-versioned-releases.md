---
status: superseded
supersededBy: [40]
---

# ADR-025: Versioned Internal Releases + Public-Surface Gate for `salvageunion-reference`

**Superseded by [ADR-040](040-dataset-served-verbatim.md)** (2026-10-08). The reference package has no release stream: no version, no `CHANGELOG.md`, no release-please component. Its API-report half had already been withdrawn (2026-09-28); the JSON-schema drift check it relied on is `bun run check generated`, which predates it.

Full text: `git show bc9f08ce:docs/ARCHITECTURE.md` (its `## ADR-025` section)
