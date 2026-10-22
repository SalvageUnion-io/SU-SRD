# e2e — the Playwright specs

Harness notes: `playwright.config.ts`'s header; sign-in: `fixtures.ts`.

- Every spec imports `test`/`expect` from `./fixtures`; signed out says so
  with `test.use({ account: 'anonymous' })`.
- Open pages with `openApp` / `openWizard` (`_helpers.ts`, on
  `gates/lib/appPage.ts`), never `page.goto` + `waitForReady`. Reach a
  wizard step by its content (`pickByName`, `advanceUntilVisible`); build
  with `buildPilot` & co.
- Shared steps: sheets `_helpers.ts` (`openSheetFor`, `addThroughPicker`),
  Training Bay `_trainingBay.ts`, Games `_table.ts`, Play `_play.ts`, axe
  `_a11y.ts`. Add a step there, not inline in a second spec.
- One file per surface. Layout gates: `_x.ts`'s `find<Rule>` → `Finding[]`
  (`_findings.ts`), run by `design-walk.e2e.ts` or `expectCorpusClean`.
- PR tier: tests tagged `{ tag: '@pr' }`.
- Wait on state (`expect`, `waitFor`), not `waitForTimeout`.
