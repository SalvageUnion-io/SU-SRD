---
name: srd-gate
description: Change srd's output safely — run the gate, READ the snapshot diff, and only then re-bless it
allowed-tools: Bash, Read, Grep
---

# The srd output gate

The commands are two lines. The failure mode is **re-blessing without reading
the diff**, which the gate's own documentation calls out as defeating the entire
mechanism — and which is invisible, because a re-blessed snapshot is green by
construction. That is what makes this a decision procedure rather than a script.

## The loop

```sh
bun --filter srd gate            # build, then diff against the committed snapshot
```

Three outcomes, and they mean different things:

| exit | meaning | what to do |
|------|---------|------------|
| 0 | output matches the snapshot | nothing |
| 1 | output differs | **read the diff**, then decide (below) |
| 2 | no build to check | a missing `dist` — never treat this as "nothing changed" |

## When it fails, read before you re-bless

The snapshot is **one line per page**, so "23 pages changed" is literally 23
changed lines. That diff is the deliverable: it is the complete, reviewable
statement of what your change did to a 1,039-page site.

Ask, in order:

1. **Is the number of changed pages the number you expected?** A one-component
   change that moves 1,039 lines means you changed something shared. A route
   change that moves zero means it did not take effect.
2. **Did the file SET change?** Additions and removals are pages appearing and
   disappearing. A removal you did not intend is a route dropped from
   `ssg/routes.ts`.
3. **Did titles, descriptions or canonicals move on pages you did not touch?**
   That is usually a layout or metadata helper reaching further than intended.
4. **Did `_headers` change?** It is generated — `ssg/csp.ts` writes the CSP's
   inline-script hashes into it — so a change there means the set of inline
   scripts on the site changed. Verify that is what you did.

Only once you can say what each group of changed lines *is*:

```sh
bun --filter srd snapshot:update   # re-bless
```

and **commit the snapshot in the same change**, so the diff is reviewed
alongside the code that caused it. `.github/CODEOWNERS` puts a named reviewer on
that file for this reason.

## What the gate does NOT cover

Knowing this stops you trusting a green gate for the wrong thing:

- **Bundle bytes** (`assets/**`, `sw.js`) and binary assets. Content-addressed
  names are normalised to `-[hash]`, so the file *set* is asserted but content
  is not.
- **Markup and attributes inside `<main>`** — the digest is of visible TEXT.
  Verified concretely: the `CardImage` regression that hid every piece of entity
  artwork behind `style="opacity:0"` (#717) does **not** fail this gate.
  **Visual regressions are not this gate's job — look at the page.**
- **CSS.** A stylesheet that silently stops shipping changes no digested text.
  `bun run check:srd-css` covers that separately.

## Its real limit

Parity (the Astro-era check this replaced) compared against a foreign **oracle**,
so it could catch output that was wrong from the start. This compares against
what was last blessed. **A wrong output committed as the snapshot is wrong
forever.** That is the price of a baseline that survives, and it is the whole
reason step "read the diff" is not optional.

## `/changelog` is exempt, deliberately

It renders from two `CHANGELOG.md` files release-please **prepends** to, so under
equality every release PR would fail this gate and need a regeneration to land —
a release deadlock. It is compared with `isInsertionOf`: everything previously
emitted must still be present, in order, with growth confined to one contiguous
insertion. Deleting, reordering or rewording an old entry still fails. The gate
prints this exemption on every run.
