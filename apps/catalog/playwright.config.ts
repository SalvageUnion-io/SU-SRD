import { e2eConfig } from 'gates/playwright'
import { portFor } from 'gates/ports'

/**
 * The story catalog's end-to-end suite, which is its axe scan
 * (`e2e/stories-a11y.e2e.ts`): `packages/gates/lib/playwrightBase.ts` with the
 * catalog's port. Nothing builds the catalog, so CI serves its dev server as
 * a local run does. Vite compiles each story's module on its first request;
 * the spec sets its own budget for the whole sweep.
 */
export default e2eConfig({
  port: portFor('stories'),
  local: { timeout: 60_000, expect: 15_000 },
  ciCommand: 'bun run dev',
})
