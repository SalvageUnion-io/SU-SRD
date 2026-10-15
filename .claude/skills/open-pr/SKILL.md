---
name: open-pr
description: Use when opening a pull request in this repo, writing or fixing a PR title or body, opening one from a cloud session, opening a dependent (stacked) PR, or when the "PR title" check fails.
allowed-tools: Bash, Read
---

# Opening a PR

`main` squash-merges: the PR **title** becomes the commit subject the
changelog reads, and the PR **body** becomes the commit body, the decision
record (`git log --format='%h %s%n%b'`). Write both for that reader, not for
the review.

## Title

A conventional commit: `type(scope): description`, scope optional (several
scopes comma-separated), `!` for a breaking change. The one source of the
regex and the type list is the `pr-title` job in
[`.github/workflows/pr-title.yml`](../../../.github/workflows/pr-title.yml);
read it there rather than from memory. A title that does not match fails that
required check, and an edited title reruns it on its own: no push needed.

## Body

The headings of
[`.github/pull_request_template.md`](../../../.github/pull_request_template.md),
in order, each short:

- **Summary** — what this PR does, in a sentence or two.
- **Why** — the problem or decision; cite the ADR or issue (`#123`).
- **What changed** — the change by area, not by file.
  Every PR into `main` is a release: it must bump the root `package.json`
  `version` over `main`'s (patch for a fix, minor for a feature, major for a
  breaking change; CI's `version-bump` job fails otherwise), and this section,
  word for word and minus `Closes #N` lines, becomes the GitHub release notes
  when it merges (`tools/release.ts`). Open PRs into `main` each need their own
  version; after another one merges, update the branch and bump past it.
- **Verification** — what you ran (`bun run check`, a `bun run shot`) and what
  you looked at.
- **Follow-ups** — what is left. Ideas you did not build go here,
  not into the diff.

Delete a heading only when it would read "None" and add nothing. Never paste
tokens, secrets or environment values into a body: it is permanent history.

## Opening it

Validate first: `bun run check:fast` at least, `bun run check` for anything
cross-package. Push the branch, then open the PR as a **draft** against the
base `bun packages/gates/lib/baseBranch.ts` prints:

- **Locally:** `gh pr create --draft --title … --body-file …`.
- **Cloud session:** `gh` answers REST only, so `gh pr create` gets 403. Use
  the `mcp__github__create_pull_request` tool (`draft: true`), or REST:
  `gh api repos/{owner}/{repo}/pulls -f title=… -f head=… -f base=… -F draft=true -F body=@body.md`.

Then subscribe the session to the PR (`subscribe_pr_activity`) so CI results
and reviews wake it, unless whoever asked for the PR says not to.

## Dependent PRs

A PR that builds on another unmerged PR lands only as a `gh stack`; the
commands and the rules are the [Merging](../../../AGENTS.md#merging) section of
the root `AGENTS.md`. Do not open it as a plain PR against the other branch.
