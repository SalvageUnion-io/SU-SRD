# tools/ — the repo's gates and scripts

Each file is a CLI run by Bun (`bun tools/<name>.ts`) whose header docstring
says what runs it and why; read that, not a roster. They reach `gates`
(`packages/gates`) and `salvageunion-reference` by package name, never a
relative path.

**Every gate is registered once**, in the `CHECKS` list in
[`check.ts`](check.ts): `bun run check`, `check:fast`, pre-push and CI's
`static-checks` all run it with a different profile.

**Adding a gate:** first prefer what already fails the build (typecheck, a
Biome rule, a package `exports` map). A new gate's header cites the incident it
prevents; register it in `CHECKS` (id, command, `guards`, `fix`, profiles, CI
areas), never as a step in `ci.yml` or `lefthook.yml`.

**Editing a checker:** tests are in `tools/__tests__/` (`bun --filter tools
test`) and `packages/gates/__tests__/`. A gate that scans a tree proves it
scanned one (`packages/gates/lib/scanFloor.ts`,
`packages/gates/lib/workspaceCoverage.ts`) and prints the corpus size.

**Ratchets:** coverage `FLOORS` (`run-coverage.ts`), page budgets (`PAGES` in
`e2e/perf-budget.e2e.ts`) and `baselines/` move only toward stricter; loosening
one is on purpose, said in the PR.

`packages/gates` holds the shared library (`lib/`), the styling and copy rule
sets (`rules/`, run by `check-rule-sets.ts`) and the GritQL plugins (`biome/`).
