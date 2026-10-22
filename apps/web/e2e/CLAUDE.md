# e2e — the Playwright specs

Harness notes: `playwright.config.ts`'s header; sign-in: `fixtures.ts`.

- Every spec imports `test`/`expect` from `./fixtures`; signed out says so
  with `test.use({ account: 'anonymous' })`.
- Open pages with `openApp` / `openWizard` (`_helpers.ts`, on
  `gates/lib/appPage.ts`, which the seeder uses too), never a bare
  `page.goto` + `waitForReady`. Reach a wizard step by its content
  (`pickByName`, `advanceUntilVisible`); build with `buildPilot` & co.
- Shared steps: sheets `_helpers.ts` (`openSheetFor`, `addThroughPicker`),
  Training Bay `_trainingBay.ts`, Games `_table.ts`, Play `_play.ts`, axe
  `_a11y.ts`. Add a step there, not inline in a second spec.
- One file per surface (`pilot-wizard.e2e.ts`). Layout gates: a scanner
  `_x.ts` + its `__tests__/`, run by `design-walk.e2e.ts` (signed in) or a
  corpus spec (signed out).
- Wait on state (`expect`, `waitFor`), not `waitForTimeout`.
