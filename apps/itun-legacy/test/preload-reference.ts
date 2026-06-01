/**
 * Bun test preload script for in-the-union-now tests.
 * Loads all salvageunion-reference schemas before any test runs so that
 * test files that call SalvageUnionReference.Chassis.all() etc. work
 * without needing per-file beforeAll() calls.
 */
import { SalvageUnionReference } from 'salvageunion-reference'

await SalvageUnionReference.preload('all')
