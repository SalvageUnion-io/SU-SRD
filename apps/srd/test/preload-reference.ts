/**
 * Bun test preload script for srd tests.
 * Loads all salvageunion-reference schemas before any test runs so that
 * test files that access SalvageUnionReference models work without
 * needing per-file beforeAll() calls.
 */
import { SalvageUnionReference } from 'salvageunion-reference'

await SalvageUnionReference.preload('all')
