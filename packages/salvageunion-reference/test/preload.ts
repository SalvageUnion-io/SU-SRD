/**
 * Bun test preload script for salvageunion-reference tests.
 * Loads all schemas before any test file runs so that existing tests
 * that call SalvageUnionReference.Chassis.all() etc. work without
 * needing per-file beforeAll() calls.
 *
 * The preload.test.ts file explicitly resets and re-loads schemas itself,
 * so it is unaffected by this preload.
 */
import { SalvageUnionReference } from '../lib/index.js'

await SalvageUnionReference.preload('all')
