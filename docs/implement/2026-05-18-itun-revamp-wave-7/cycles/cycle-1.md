# Cycle 1 — Mobile-Responsive Sheet

**Run:** 2026-05-18-itun-revamp-wave-7
**Branch:** run/2026-05-18-itun-revamp-wave-7/cycle-1
**ACs covered:** AC-1, AC-2, AC-5
**Status:** complete

## Changes

| File | Change |
|---|---|
| `apps/in-the-union-now/src/components/sheet/Sheet.tsx` | Container padding: `p-6` → `p-3 sm:p-6` (both the entity-not-found guard and main render path) |
| `apps/in-the-union-now/src/components/sheet/SheetHeader.tsx` | Header layout: `flex-row` (single row) → `flex-col sm:flex-row`; back link gets `min-h-11 sm:min-h-9` touch target; h1 text `text-2xl` → `text-xl sm:text-2xl sm:truncate`; badge gets `self-start sm:self-auto` |
| `apps/in-the-union-now/src/components/sheet/MechSheet.tsx` | Stat grid: `grid-cols-3 sm:grid-cols-6` → `grid-cols-2 sm:grid-cols-3 md:grid-cols-6` (2 columns on mobile is legible at 320px; 6 columns at 320px was too compressed) |
| `apps/in-the-union-now/src/components/sheet/InlineEditField.tsx` | Display state span: `inline-block` → `inline-flex items-center justify-center min-h-11 sm:min-h-9` (44px touch target on mobile) |
| `apps/in-the-union-now/src/components/sheet/PublishButton.tsx` | Share button: added `className="min-h-11 sm:min-h-9"` to the ShadCN Button (44px touch target on mobile) |
| `apps/in-the-union-now/src/components/sheet/__tests__/mobile-responsive.test.tsx` | New test file: 6 tests covering overflow guard (AC-1) and min-h-11 class assertions (AC-5) |

## Files NOT modified (as documented)

- `ConditionToggle.tsx` — Touch-target size on mobile is a follow-up item for Wave 3 owner (as specified in cycle instructions)
- `PilotSheet.tsx`, `CrawlerSheet.tsx` — These sheets are already single-column flex layouts; no grid rework needed

## Test results

- 376 tests pass, 0 fail (bun --filter in-the-union-now test)
- 6 new tests in mobile-responsive.test.tsx

## Manual mobile review checklist

These should be verified on a real device after deployment. The happy-dom test environment cannot simulate CSS layout or computed min-height; the class-based assertions substitute as a structural proxy.

Mobile review (real device, all 4 composition modes):
1. iPhone SE class (320x568) and modern smartphone (390x844)
2. Open dashboard → tap into each entity → view sheet
3. Verify:
   - [ ] No horizontal scroll
   - [ ] All touch targets large enough (no fat-finger conflicts)
   - [ ] Text legible without pinch-zoom
   - [ ] PublishButton works; ShareURLDialog readable
   - [ ] Click-to-edit works (tap to enter edit; tap outside to save)

## Notes

- The `min-h-11 sm:min-h-9` pattern provides 44px touch targets on mobile (Tailwind `h-11 = 2.75rem = 44px`) and shrinks to 36px (`h-9`) on `sm` breakpoints (640px+). This matches the WCAG 2.5.5 AAA touch target guidance and Apple HIG.
- ConditionToggle was explicitly excluded per cycle instructions (Wave 3 scope). Its mobile touch target size should be addressed as a follow-up issue.
- MechSheet stat grid uses `md:grid-cols-6` rather than `sm:grid-cols-6` to give each stat cell a minimum comfortable width on medium tablets.
