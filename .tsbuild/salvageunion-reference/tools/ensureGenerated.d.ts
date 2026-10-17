#!/usr/bin/env bun
/**
 * ensureGenerated — make `lib/generated/` and `schemas/` exist and match their
 * inputs, regenerating only when they do not.
 *
 * Both are gitignored build output: a fresh clone has neither, and nothing in
 * the repo typechecks, tests, builds or serves without them. Every path that
 * reads them runs this first, so none depends on a developer remembering a
 * step:
 *
 *   - the root `postinstall` (a fresh `git clone && bun install`, every CI job
 *     and deploy, and the IDE, which typechecks whatever is on disk)
 *   - the root `typecheck`, `test` and `build`, once before they fan out over
 *     the workspaces, and each app's `dev`
 *   - `tools/testPreload.ts`, so a bare `bun test` works too
 *   - `tools/check.ts`, before it launches checks in parallel
 *
 * ## Why a stamp, not "always regenerate"
 *
 * A full regenerate spawns Biome once per file and takes seconds; the paths
 * above run often, several at once. So the run hashes every input the three
 * generators read — the Zod schemas and manifest (`lib/schemas/`), the data
 * (list projections and the catalog's item counts), `lib/zod.ts`,
 * `lib/naming.ts`, `lib/listProjection.ts`, the generators themselves, the
 * Biome config and `bun.lock` (which pins Zod and Biome) — and compares it with the stamp the last
 * successful run wrote. Equal, and every output present: nothing to do (~50 ms).
 * The stamp is written LAST, so a failed run leaves no stamp and retries.
 *
 * ## Why a lock
 *
 * Its callers overlap: `bun --filter "*" test` starts every workspace at once,
 * and each one whose test preload loads reference data runs this; a dev server
 * may be starting beside them. The first takes the lock
 * (`mkdir` is atomic) and regenerates; the rest wait for it, then find the
 * stamp current and return — so no reader ever sees a half-written file.
 *
 * Usage: ref-generate [--force] (this file is the package's bin)
 */
export declare function inputsHash(): string;
/** Regenerate when stale. Returns whether it regenerated. */
export declare function ensureGenerated(opts?: {
    force?: boolean;
}): boolean;
