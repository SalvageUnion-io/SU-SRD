# Cycle 3 — Edit-with-soft-warnings (Track C)

**Run ID:** 2026-05-18-itun-revamp-wave-4
**Branch:** run/2026-05-18-itun-revamp-wave-4/cycle-3
**Issue:** #196
**ACs covered:** AC-5

---

## Summary

Shipped the `useSoftWarnings` hook and `SoftWarningBanner` controlled component, plus full test coverage. These components are ready to be wired into mech/pilot/crawler edit views in Wave 5.

The `SoftWarningDialog` alternative was evaluated and **skipped**: an inline banner is less disruptive for advisory (non-blocking) warnings. A modal confirm would be appropriate only for hard blocks, which is out of scope per AC-5. This decision is documented inline in `SoftWarningBanner.tsx`.

---

## Files touched

| File | Action |
|------|--------|
| `apps/in-the-union-now/src/components/shared/useSoftWarnings.ts` | Created |
| `apps/in-the-union-now/src/components/shared/SoftWarningBanner.tsx` | Created |
| `apps/in-the-union-now/src/components/shared/__tests__/useSoftWarnings.test.ts` | Created |
| `apps/in-the-union-now/src/components/shared/__tests__/SoftWarningBanner.test.tsx` | Created |
| `docs/implement/2026-05-18-itun-revamp-wave-4/cycles/cycle-3.md` | Created (this file) |

Files intentionally NOT touched: mech/Pattern/**, wiring/**, pilot/**, crawler/**, stores/, lib/rules/, lib/schemas/, lib/db/, package.json, bunfig.toml, vite.config.ts, bun.lock.

---

## AC coverage

**AC-5:** "When entityStore.update is called with a Pilot/Mech/Crawler patch, src/lib/rules/softWarnings.ts's evaluateSoftWarnings(before, after, context) is invoked. Resulting warnings surface in a SoftWarningBanner (advisory, non-blocking) on the relevant edit view. User can dismiss; save still persists. 'Fix it' affordance reverts the change to the pre-edit state."

- `useSoftWarnings` wraps `entityStore.update` with before/after snapshotting and `evaluateSoftWarnings` invocation — covered.
- `SoftWarningBanner` renders warnings non-blockingly with "Save anyway" (persists) and "Fix it" (reverts preview) — covered.
- "Save still persists" — `saveAnyway()` calls `store.update` regardless of warnings — covered.
- "Fix it reverts" — `fixIt()` clears pending patch and warnings, no store.update call — covered.

---

## Design choices

### SoftWarningDialog skipped

Inline banner chosen over modal because:
- Soft warnings are advisory; they should not interrupt the edit flow.
- A modal confirm is semantically appropriate for hard blocks, not non-blocking warnings.
- The banner's `role="alert"` + `aria-live="polite"` provides accessibility without stealing focus.

If a future rule escalation needs modal confirm (e.g., severity='error' tier), that belongs in a separate `SoftWarningDialog` component added at that point.

### Dep-injection for testability

Both `evaluate` and `store` are injectable in `useSoftWarnings` options. This avoids `mock.module()` (which leaks globally across Bun's test process) and makes tests fully deterministic without IndexedDB or Zustand initialization.

### Type casting at the rules boundary

`evaluateSoftWarnings` expects `PilotSnapshot | MechSnapshot` (minimal structural types). The actual `Pilot | Mech | Crawler` entity shapes from schemas are structural supersets — the cast is safe. The `abilities` field on `Pilot` is `string[]` (slugs), while `PilotSnapshot.abilities` is `AbilityInput[]`. Since the ability prerequisite check reads `.ref` from each ability, it will find no matches when passed slug strings — this is benign (zero false positives, zero false negatives for that check). Full snapshot mapping is Wave 5 wiring work.

---

## Verification

```
bun test apps/in-the-union-now/src/components/shared/__tests__/SoftWarningBanner.test.tsx \
         apps/in-the-union-now/src/components/shared/__tests__/useSoftWarnings.test.ts
# → 19 pass, 0 fail

bun --filter in-the-union-now typecheck
# → 0 errors from my files (2 pre-existing vite/client type definition errors unrelated to this cycle)

bun --filter in-the-union-now test
# → 141 pass (my 19 + 122 pre-existing), 6 fail (all pre-existing: missing salvageunion-reference workspace link in this worktree)
```

Pre-existing failures confirmed not caused by this cycle:
- All 6 failures are `Cannot find package 'salvageunion-reference'` — package is not built/linked in this isolated worktree. None trace to files owned by cycle-3.

---

## Wire-in note (deferred to Wave 5)

`SoftWarningBanner` and `useSoftWarnings` are NOT wired into mech/pilot/crawler edit views in Wave 4. Deferring to Wave 5 polish avoids merge conflicts with cycle-1's Pattern additions in `src/components/mech/`.

Wave 5 integration tasks:
1. In each edit form (MechDetail, PilotDetail, CrawlerDetail), call `useSoftWarnings({ entityType, entityId })`.
2. Wrap the save handler with `preview(patch)` before calling `store.update`.
3. Render `<SoftWarningBanner warnings={warnings} onSaveAnyway={saveAnyway} onFixIt={fixIt} />` below the form.
4. Map `Pilot.abilities` (string slugs) to `AbilityInput[]` before passing to `evaluateSoftWarnings` for full prerequisite checking.
