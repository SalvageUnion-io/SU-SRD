---
name: stacked-pr
description: Recover a stacked PR after the layer beneath it merges, on a squash-merge repo where --force can resurrect an already-merged branch
allowed-tools: Bash, Read, Grep
---

# Stacked PR recovery

`main` is **squash-merge** with `delete_branch_on_merge`. Both settings are
deliberate, and together they make two things behave in ways that cost real time
when met cold. This is a decision procedure, not a command wrapper: the commands
are three lines, and picking the wrong one either reopens a merged PR or leaves
a layer reporting fourteen files when it changed three.

Full reasoning, with the incident that produced it, is in
[`.claude/rules/stacked-prs.md`](../../rules/stacked-prs.md). Read it if
anything below surprises you.

## 1. Record the parent's tip BEFORE you touch anything

```sh
git rev-parse <parent-branch>   # write this down
```

The branch ref moves during the rebase. After that, the range you need is
unrecoverable without the reflog. This is the single most common way this goes
wrong, and it goes wrong silently — you only find out when the rebase replays
the wrong commits.

## 2. The layer beneath you merged — now what

A squash merge puts **one new commit** on `main` and none of that branch's
original SHAs. Your layer still carries those SHAs, so GitHub retargets you to
`main` and your PR reports **its own work plus everything below it**.

Do **not** reach for `gh pr update-branch --rebase`. It fails with
`rebase conflict between base and head`, because the duplicated commit collides
with its own squashed self.

```sh
git fetch origin
git rebase --onto origin/main <recorded-parent-tip> <your-branch>
git push --force-with-lease
```

`--onto` replays only the commits *after* the old branch point, dropping the
duplicate instead of re-applying it.

**A conflict here should be the duplicate and nothing else.** If `--onto` raises
a conflict that is genuinely about *your* changes, stop — two layers edited the
same lines, which is a real merge problem and not this one.

## 3. Verify before you believe it

```sh
git diff --stat <new-base>..HEAD
```

The PR must show **only that layer's own files and commits**. A rebase that
looks clean and leaves a duplicate is the failure mode this whole procedure
exists to avoid, and it is invisible unless you check.

## 4. `--force-with-lease`, never `--force`

Not for the textbook reason. The usual argument is "someone else pushed to your
branch". Here the likelier case is that **the branch no longer exists** — the
merge deleted it — and the lease refuses to push to a ref that is gone.

A bare `--force` there would **recreate a deleted branch and reopen the head of
an already-merged PR**. That looks like live work, invites a second merge of
something already landed, and takes a while to diagnose from the other end.

`Bash(git push --force *)` is in `.claude/settings.json`'s deny list for exactly
this reason. If you find yourself wanting it, you want `--force-with-lease` and
the lease is telling you something true.

Recovery when the lease rejects a push as `stale info` and the branch is gone:
cherry-pick the orphaned commit onto fresh `main` as a new branch. Do not force
the old one back into existence.

## 5. Three or more layers: use `gh stack`

`gh stack sync` owns the cascading rebase, which is the part that gets expensive
as layers multiply, and it handles the squash artefact above by itself. Below
three layers the ceremony is not worth it.

Two things that will stop you cold otherwise:

- `gh stack init <branch>` — **the branch argument is required.** The bare form
  fails with `interactive input required`, which halts an unattended agent.
- The state lives **per WORKTREE** (`.git/worktrees/<name>/gh-stack`), not per
  clone. Two worktrees of this repo share no stack state, so a branch that is
  stacked on GitHub looks unstacked from anywhere else with nothing on disk
  explaining why. `gh stack checkout <pr#|branch>` re-attaches. Run
  `gh stack view` before concluding anything about a stack's shape.

`gh stack init` anchors the trunk to your **local** `main`, which in this repo
nobody checks out and is therefore usually stale. That field is cosmetic — sync
acts on `origin/main` regardless — so do not read it as truth. `sync` also warns
that it cannot fast-forward local `main` because the primary worktree has it
checked out; that is benign and it degrades to `origin/main`, which is the ref
you wanted.

## 6. CI runs on every layer, and that is deliberate

`ci.yml` has **no `branches:` filter** on `pull_request`. That filter matches the
PR's *base*, so `branches: ['main']` silently gave zero checks to every layer
above the bottom one — and since `CI Success` is required, those PRs were not
merely unchecked but unmergeable, with nothing on the PR saying why. Leave it
unfiltered.
