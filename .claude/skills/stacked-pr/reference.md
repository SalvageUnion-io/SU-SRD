# Stacked PRs — reference

The parts of the stacked-PR knowledge that `SKILL.md` does not carry. Read the
skill first; open this when you are running a `gh stack`, or when two agents
share one stack. Written from the #799 Tailwind-removal work, which ran a
four-deep stack through four merges (all four `--onto` rebases conflict-free,
because the only overlap was the squash artefact).

## `gh stack` in practice

- `gh stack submit --auto --open` — `--auto` takes an auto-generated title, so
  set the real title and body with `gh pr edit` afterwards.
- `gh stack sync` after **every** merge beneath you. Do not hand-rebase inside a
  gh-managed stack; that is how the tool's state and the branches diverge.
- `gh stack merge` lands several layers at once: all-or-nothing up to a chosen
  PR, and it cannot bypass merge requirements. An ordinary
  `gh pr merge --squash` on the bottom layer is fine too — `sync` reconciles it.
- Before `gh stack init`, bring local `main` up to date
  (`git fetch origin && git checkout main && git pull`, in the primary
  worktree). `init` anchors the trunk to **local** `main`, and the persisted
  `trunk.head` never catches up by itself — `sync` cannot fast-forward a `main`
  that another worktree has checked out.

### What `sync` does when a layer merges beneath you (measured)

```
✓ Skipping feat/tw-atoms-capslabel (PR #820 merged)
Skipping 1 merged branch
Merged: #820
✓ Branches synced
  Stacked on origin/main (9be883f)
```

Exit 0, no conflict, no `--onto` needed; `gh stack view` then files the branch
under `merged`. The tool handles the squash artefact itself.

On a later run it may also print:

```
⚠ Could not update local main: failed to run git: fatal: cannot force update
  the branch 'main' used by worktree at '/Users/jarvis/Code/SU-SRD'

  Rebasing the stack onto origin/main instead; local main is unchanged.
```

**Benign.** The primary worktree always has `main` checked out, so git refuses
the convenience fast-forward and the tool falls back to `origin/main`, which is
the ref that was wanted. Do not delete the worktree or force the ref to silence
it — that trades a cosmetic message for a real problem.

## Two agents on one stack: a read is only true when it is taken

One agent merging while another pushes will routinely send each other state
that is already stale — on #799 three consecutive "this PR is at N files"
reports were overtaken by a push before they arrived.

- **Verify before acting** on someone else's state line. Re-query, then act.
- **Say what you want, not what you see** — "cascade #817 when #816 lands"
  keeps its meaning; "#817 is at 11 files" expires.
- **Say who merged.** "None merged" meaning "I merged nothing" reads as
  "nothing has merged" to someone merging underneath you.
