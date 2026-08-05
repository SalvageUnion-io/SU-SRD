# ADR-024: Derived, Per-App Release Changelogs for the Sites

## Status

Accepted.

## Context

The two user-facing sites announce changes very differently today:

- **`apps/srd`** has a hand-maintained changelog: a typed array in
  `src/lib/changelog.ts` (`{ date, title, items[] }`) rendered at `/changelog`
  and linked from the top/mobile nav. Its upkeep is governed by a "Changelog
  Maintenance" section in [`apps/srd/CLAUDE.md`](../../apps/srd/CLAUDE.md)
  — one hand-authored entry **per PR**, edited in place on the branch.
- **`apps/itun`** has **no** release changelog at all. Its About
  page is static, and its in-app "Change Log" is a **per-entity provenance
  trail** ([ADR-022](ADR-022-provenance-log-and-overrides.md)), not release
  notes.

The repo already squash-merges with **conventional-commit PR titles**
(`feat:`, `fix:`, …) and gates every PR behind a single aggregate
`quality-checks` status check. That is exactly the structured input release
tooling consumes.

The stated goal is **formal releases + on-site release history at the least
ongoing processing**. Two approaches were weighed:

- **Enforce a hand-written changelog via CI** — a paths-filter gate that fails
  a PR touching app source without a changelog edit. This is the _highest_
  processing path: hand-authored prose on every PR **plus** a nag gate. It is
  explicitly rejected.
- **Derive the changelog from the commits already written** — no per-PR prose;
  the notes fall out of the conventional titles. This is the least-processing
  path and is the decision below.

## Decision

Release notes are **derived from conventional squash-commit titles via
[release-please](https://github.com/googleapis/release-please) (manifest
mode)**, never hand-authored. A single `release-please-config.json` +
`.release-please-manifest.json` at the repo root governs all versioned
components. This ADR covers the two **site** components;
[ADR-025](ADR-025-reference-versioned-releases-surface-gate.md) covers the
`salvageunion-reference` component and its surface gate. They share the one
config.

- **Two separate site streams.** `apps/srd` and `apps/itun`
  are each independently versioned with their **own** generated `CHANGELOG.md`.
  Streams are separate so an SRD-site visitor never sees ITUN entries and vice
  versa — preserving the scoping the current hand-written web changelog already
  enforces.

- **On-site render = the app's own changelog merged with the ref's.** Each
  site's `/changelog` renders a **build-time merge** of its own `CHANGELOG.md`
  **and** the `salvageunion-reference` `CHANGELOG.md`. Rationale: for a
  _reference_ tool, "what's new" is largely **new game data**, which lives in
  the ref package, not the app — a web-only stream would regress the current
  changelog's usefulness. The merge is **hermetic**: it parses committed
  markdown files at build time, with **no network / GitHub-API call** (Netlify
  builds must not depend on a live API or token). Entries carry a small area
  tag (e.g. _App_ vs _Data_).

- **`component-lib` is deliberately not its own stream.** It is an internal
  shared library with no independent release surface. A pure-`component-lib` PR
  with no app file touched will **not** appear on either site's changelog — an
  accepted gap (in practice a user-visible shared-UI change rides with an app
  change). Promote it to a component later if the gap ever bites. The
  `discord-bot` is likewise excluded (no on-site history to render).

- **The release PR is the batched, optional curation point.** Default behaviour
  is **zero-processing** auto-generated notes. If polish is wanted, edit the
  release PR's `CHANGELOG.md`/body **before merging** — a batched, per-release
  choice, not per-PR work.

- **Seeding & migration.** `.release-please-manifest.json` seeds `srd`
  at `1.0.0` and `itun` at `0.1.0`, with `bootstrap-sha` at the
  adopting commit so the first release PR is forward-looking. The existing
  ~35 `changelog.ts` entries are **backfilled** into
  `apps/srd/CHANGELOG.md` as a historical tail (nothing is lost);
  `changelog.ts` is then removed and the `/changelog` page reads the markdown.

- **This supersedes the "Changelog Maintenance" section of
  `apps/srd/CLAUDE.md`** (per-PR hand-authored entries). It is replaced by
  guidance to write a good conventional PR title; the changelog is generated.

- **CI / merge interplay.** release-please runs as a workflow on push to `main`.
  It must authenticate with a **PAT**, not the default `GITHUB_TOKEN`, so its
  release PRs trigger `ci.yml` and the required `quality-checks` check reports
  (a `GITHUB_TOKEN`-opened PR triggers no workflows and would be unmergeable).
  This is a one-time repo-secret setup step, documented at rollout. Release PRs
  touch only `CHANGELOG.md` / `package.json` version / the manifest, so they
  pass the suite cleanly, and land via the existing squash-only + auto-merge
  flow.

- **Auto-merge is armed by the workflow, not by a human.** This sentence used to
  read as though "the existing auto-merge flow" would pick release PRs up on its
  own. It does not: nothing enables auto-merge on a PR unless something asks it
  to, so the release PRs simply sat open — `srd` #688 for a day, `itun` #677 for
  two — and `main`'s `CHANGELOG.md` fell behind by exactly that much. The
  release-please workflow now re-arms auto-merge on every open
  `release-please--*` PR on each run, so a release lands as soon as
  `quality-checks` is green with no human step. It is re-asserted every run
  rather than only on creation, because a PR ejected from the merge queue (both
  release PRs edit `.release-please-manifest.json`, so one always rebases) loses
  auto-merge silently; a daily `schedule:` covers the case where no push follows.

## Consequences

- **Less ongoing work than today** — no per-PR prose — and **ITUN gains a
  changelog for free**.
- **Auto-notes are terser** than the current curated prose. The release PR is
  the place to optionally polish. Accepted trade for least-processing.
- **Pure-`component-lib` PRs may not surface** on either site changelog
  (documented gap above).
- **New moving parts:** a release-please workflow + a PAT repo secret (admin,
  one-time). If the secret is absent, release PRs won't get the required check
  and won't be mergeable — a visible failure, not a silent one.
- Each site's build gains a small, unit-tested markdown parser (validated
  against real release-please output fixtures) to render the merged changelog.
- Versioning is per-app and independent; a site's version advances only when it
  (or the ref) has unreleased conventional commits.
