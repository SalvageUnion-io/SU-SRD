# build — the Training Bay

- **Sheet layers:** route → `SheetView` | `PublicSheetView` |
  `StarterSheetView` → `Sheet` → `<Kind>LiveSheet` (rail, band) → `LiveSheet`
  (shell) → `<Kind>Sheet` (body). A read-only sheet is `<Sheet readOnly>` over
  `makeReadOnlySheetStore`; build no other.
- `*.model.ts` is any non-component module, not always pure: the `*Actions`,
  `sheetMode`, `pilotSheet`, `readOnlySheetStore`, `requestMove` and
  `assignedCrewControls` models use React or the store.
- `_rollDeps`, `_sur`, `_deps`: test seams, only passed on.
- Shot: `:pilot`, `:mech`, `:crawler`, signed in.
