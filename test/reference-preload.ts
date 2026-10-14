/**
 * Shared bun test preload: load every salvageunion-reference schema before any
 * test file runs, so tests can reach `SalvageUnionReference.Chassis.all()` (and
 * friends) without a per-file `beforeAll(() => SalvageUnionReference.preload(...))`.
 *
 * Wired into every workspace whose tests touch reference data — see each
 * `bunfig.toml`. Do NOT re-declare `preload(...)` inside a test file: the
 * loaded-schema set in `ModelFactory` is module-global and never reset, so a
 * per-file call is at best a no-op and at worst hides an ordering bug (a narrow
 * schema list appears to pass only because a sibling file already loaded
 * everything).
 *
 * Imported by relative path rather than by package name on purpose: the root
 * `test/` directory is not a workspace, so `node_modules/salvageunion-reference`
 * does not resolve from here under the isolated linker.
 */
import { ensureGenerated } from '../packages/salvageunion-reference/tools/ensureGenerated'

// `lib/generated/` is gitignored build output that the ORM imports, so it must
// exist (and be current) before the dynamic import below loads it. A no-op
// when the stamp matches; see the tool's header.
ensureGenerated()

const { SalvageUnionReference } = await import('../packages/salvageunion-reference/lib/index')

await SalvageUnionReference.preload('all')
