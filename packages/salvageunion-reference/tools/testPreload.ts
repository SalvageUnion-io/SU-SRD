/**
 * Shared bun test preload: load every salvageunion-reference schema before any
 * test file runs, so tests can reach `SalvageUnionReference.Chassis.all()` (and
 * friends) without a per-file `beforeAll(() => SalvageUnionReference.preload(...))`.
 *
 * Wired into every workspace whose tests touch reference data — see each
 * `bunfig.toml`, which names this file by path. Do NOT re-declare `preload(...)` inside a test file: the
 * loaded-schema set in `ModelFactory` is module-global and never reset, so a
 * per-file call is at best a no-op and at worst hides an ordering bug (a narrow
 * schema list appears to pass only because a sibling file already loaded
 * everything).
 */
import { ensureGenerated } from './ensureGenerated'

// `lib/generated/` is gitignored build output that the ORM imports, so it must
// exist (and be current) before the dynamic import below loads it. A no-op
// when the stamp matches; see the tool's header.
ensureGenerated()

const { SalvageUnionReference } = await import('../lib/index')

await SalvageUnionReference.preload('all')
