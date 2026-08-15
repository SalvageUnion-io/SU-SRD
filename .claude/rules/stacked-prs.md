# Stacked PRs on a squash-merge repo

This repo is **squash-only** with `delete_branch_on_merge`. Both settings are
deliberate, and together they make stacked PRs behave in two ways that surprise
people. Neither is a bug; both cost real time when met cold.

Written from the #799 Tailwind-removal work, which ran a four-deep stack through
four merges.

## 1. A squash merge orphans every layer above it

When the bottom PR squash-merges, `main` gains **one new commit** and none of
that branch's original SHAs. Every layer above it still carries those SHAs, so
GitHub retargets the next PR to `main` and it reports **its own work plus
everything below it** — a 3-file PR shows as 14.

`gh pr update-branch --rebase` cannot fix it: it fails with
`rebase conflict between base and head`, because the duplicated commit collides
with its own squashed self.

The fix is `--onto`, which replays only the commits *after* the old branch point
and drops the duplicate rather than re-applying it:

```sh
git fetch origin
git rebase --onto origin/main <old-parent-branch-tip> <this-branch>
git push --force-with-lease
```

Record the parent's tip SHA **before** rebasing — the branch ref moves, and
after that the range is unrecoverable without the reflog.

**A conflict here should be the duplicate and nothing else.** All four rebases on
#799 were conflict-free, precisely because the only overlap was the squash
artefact. If `--onto` raises a conflict that is genuinely about *your* changes,
stop: that means two layers edited the same lines, which is a real merge problem
and not this one.

**Verify before pushing**, every time — the PR should show only that layer's own
files and commits. That check is the whole point; a rebase that looks clean and
leaves a duplicate is the failure mode.

## 2. `--force-with-lease`, never `--force`

Not the textbook reason. The usual argument for the lease is "someone else
pushed to your branch". On this repo the more likely case is that the **branch no
longer exists**: the merge deleted it, and the lease refuses to push to a ref
that is gone.

A bare `--force` there would **recreate a deleted branch and reopen the head of
an already-merged PR** — which looks like live work, invites a second merge of
something already landed, and takes a while to diagnose from the other end.

This happened on #799: a doc commit was in flight when the PR merged, and the
lease rejected the push as `stale info`. The right recovery is to cherry-pick the
orphaned commit onto fresh `main` as a new branch, not to force the old one back
into existence.

**On a squash-merge repo with `delete_branch_on_merge`, `--force` can resurrect
state the merge deliberately destroyed. The lease is what stops it.**

## 3. Prefer `gh stack` for anything more than two layers

The official `github/gh-stack` extension owns the cascading rebase, which is the
part that gets expensive as layers multiply. Use it once a change wants three or
more reviewable layers; below that the ceremony is not worth it.

- `gh stack init <branch>` — **the branch argument is required.** The bare form
  fails with `interactive input required; provide branch names as arguments`,
  which will stop an unattended agent that assumes otherwise.
- `gh stack submit --auto --open` — `--auto` takes an auto-generated title, so
  set the real title and body with `gh pr edit` afterwards.
- `gh stack sync` after **every** merge beneath you. Do not hand-rebase inside a
  gh-managed stack; that is how the tool's state and the branches diverge.

**Stack state lives in `.git/gh-stack`, which is per-clone and untracked.** A
fresh agent worktree therefore does not inherit it: the branch is stacked on
GitHub and looks unstacked locally, with nothing on disk explaining why.
`gh stack checkout <pr#|branch>` re-attaches. Run `gh stack view` before
concluding anything about a stack's shape.

## 4. A read is only true at the instant it is taken

Two agents working one stack — one merging, one pushing — will routinely send
each other state that is already stale. On #799 three consecutive "this PR is at
N files" reports were overtaken by a push before they arrived. Nobody was wrong;
the reads were accurate when taken.

Two habits that make this cheap:

- **Verify before acting** on someone else's state line. Re-query, then act.
- **Say what you want, not what you see** — "cascade #817 when #816 lands" keeps
  its meaning; "#817 is at 11 files" expires.

Related: when reporting merge status, say *who* merged. "None merged" meaning "I
have merged nothing" reads as "nothing has merged" to someone who is merging
underneath you.
