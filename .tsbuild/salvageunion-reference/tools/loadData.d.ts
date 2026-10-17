/**
 * Shared data-loading helper for the validation tooling.
 *
 * One loader for every validator, so:
 *   - `tools/validate.ts` (the one validation CLI) can load every
 *     `data/*.json` file exactly once and hand the same in-memory bag to all
 *     checks.
 *   - tests and generators can load real data without re-deriving the
 *     `data/` path resolution in each file.
 *
 * `dataDir` is resolved relative to this file's location (not `process.cwd()`)
 * so every caller gets the same directory regardless of where `bun` was
 * invoked from.
 */
/** Absolute path to `packages/salvageunion-reference/data`. */
export declare const dataDir: string;
/** Every `*.json` filename in `data/`, sorted for deterministic ordering. */
export declare function listDataFiles(): string[];
/**
 * A single shared-load pass over every data file: filename -> parsed array.
 * This is the "load once" bag every check in `tools/validate.ts` reads from.
 */
export type DataBag = Record<string, Record<string, unknown>[]>;
export declare function loadAllDataFiles(): DataBag;
