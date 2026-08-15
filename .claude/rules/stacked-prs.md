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

### Where the state actually lives — per WORKTREE, not per clone

**In a linked worktree the state is `.git/worktrees/<name>/gh-stack`, not
`.git/gh-stack`.** Verified by reading it, after this file first said otherwise.

That is narrower than "per clone", and the difference matters here because
almost all agent work happens in linked worktrees: two worktrees of the same
repo share **no** stack state at all. A branch that is stacked on GitHub looks
unstacked from any other worktree, with nothing on disk explaining why.
`gh stack checkout <pr#|branch>` re-attaches. Run `gh stack view` before
concluding anything about a stack's shape.

### `gh stack init` anchors the trunk to your LOCAL `main`

Not `origin/main`. In this repo nobody checks out `main` — every branch is cut
from `origin/main` in a worktree — so the local ref sits wherever it was last
left, and on the run that produced this file it was **~40 commits stale**:

```
stack trunk recorded: 1a99ef7b   ← local main, months old
origin/main:          af60dbd3
branch's actual base: af60dbd3   ← correct
```

The PR was unaffected: GitHub compares against the real base, and `gh stack sync`
reported the true trunk (`Stacked on origin/main (9be883f)`) regardless. But the
persisted `trunk.head` stayed stale even after a sync, so **do not read that
field as truth** — it is not what the tool acts on. `git fetch origin && git
checkout main && git pull` before `gh stack init` avoids the confusion entirely.

### What `sync` does when a layer merges beneath you

Measured, since this was the open question the whole experiment existed to
answer. After the bottom PR squash-merged:

```
✓ Skipping feat/tw-atoms-capslabel (PR #820 merged)
Skipping 1 merged branch
Merged: #820
✓ Branches synced
  Stacked on origin/main (9be883f)
```

Exit 0, no conflict, no `--onto` needed, and `gh stack view` then files the
branch under a `merged` heading. **The tool handles the squash artefact that
section 1 describes** — which is the reason to prefer it once a change has three
or more layers.

An ordinary `gh pr merge --squash` on the bottom layer is what produced that, and
sync reconciled it cleanly, so a merging reviewer does not have to learn a new
verb for a one-layer stack. `gh stack merge` remains the path for landing several
layers at once: it is all-or-nothing up to a chosen PR, and it cannot bypass
merge requirements.

### `sync` cannot update local `main` here, and says so — this is benign

On a second run it emitted a warning the first run did not:

```
⚠ Could not update local main: failed to run git: fatal: cannot force update
  the branch 'main' used by worktree at '/Users/jarvis/Code/SU-SRD'

  Rebasing the stack onto origin/main instead; local main is unchanged.
```

**Nothing is wrong.** `sync` tries to fast-forward the local `main` ref as a
convenience, and git refuses because `main` is checked out in the primary
worktree — which it always is here, since that checkout is never moved off it.
The tool degrades to `origin/main`, which is the ref that was wanted anyway, and
exits 0.

This is also the *mechanism* behind the stale trunk noted above: `sync` cannot
advance local `main`, and `gh stack init` anchored the trunk to local `main`, so
the recorded trunk can never catch up on its own. Two symptoms, one cause.

Worth recognising rather than debugging: it is a scary-looking `fatal:` inside a
warning on an otherwise successful command, and the natural reaction — deleting
the worktree, or forcing the local ref — would trade a cosmetic message for a
real problem.

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
