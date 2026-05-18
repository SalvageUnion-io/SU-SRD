import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// merge_downtime_receipt RPC — static contract tests
//
// These tests do not connect to a real database. Instead they verify that:
//   1. The migration file exists and uses the correct function name
//   2. The allowlist in the migration covers all expected receipt fields
//   3. The migration uses jsonb_set for atomic updates (no SELECT before UPDATE)
//   4. SECURITY INVOKER is set (consistent with all other RPCs in the codebase)
// ---------------------------------------------------------------------------

const MIGRATION_PATH = join(
  import.meta.dir,
  '../../../../supabase/migrations/20260317000000_downtime_atomic_rpcs.sql'
)

const EXPECTED_ALLOWLIST_FIELDS = [
  'offload_receipts',
  'restore_receipts',
  'craft_receipts',
  'training_receipts',
  'equipment_receipts',
  'customise_acknowledged',
  'rumour_receipts',
] as const

describe('merge_downtime_receipt migration', () => {
  const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8')

  test('migration file exists and is non-empty', () => {
    expect(migrationSql.length).toBeGreaterThan(0)
  })

  test('defines merge_downtime_receipt function', () => {
    expect(migrationSql).toContain('merge_downtime_receipt')
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION merge_downtime_receipt')
  })

  test('uses SECURITY INVOKER (consistent with codebase RPC pattern)', () => {
    expect(migrationSql).toContain('SECURITY INVOKER')
  })

  test('uses jsonb_set for atomic merge (no read step)', () => {
    expect(migrationSql).toContain('jsonb_set')
    // Must NOT have a SELECT query (no read-modify-write)
    const selectStatements = migrationSql
      .split('\n')
      .filter((line) => /^\s*SELECT\s/i.test(line) && !/--/.test(line))
    expect(selectStatements).toHaveLength(0)
  })

  test('allowlist covers all expected receipt fields', () => {
    for (const field of EXPECTED_ALLOWLIST_FIELDS) {
      expect(migrationSql).toContain(`'${field}'`)
    }
  })

  test('allowlist count matches expected field count', () => {
    // Count occurrences of receipt field names within the allowlist guard block
    const allowlistBlock = migrationSql.match(/IF p_field.*?END IF/s)?.[0] ?? ''
    const foundFields = EXPECTED_ALLOWLIST_FIELDS.filter((field) =>
      allowlistBlock.includes(`'${field}'`)
    )
    expect(foundFields).toHaveLength(EXPECTED_ALLOWLIST_FIELDS.length)
  })

  test('accepts p_record_id, p_field, p_pilot_id, p_receipt parameters', () => {
    expect(migrationSql).toContain('p_record_id')
    expect(migrationSql).toContain('p_field')
    expect(migrationSql).toContain('p_pilot_id')
    expect(migrationSql).toContain('p_receipt')
  })

  test('returns jsonb (the updated row)', () => {
    expect(migrationSql).toContain('RETURNS jsonb')
  })
})

// ---------------------------------------------------------------------------
// TypeScript type contract — verifies database-generated.types.ts is in sync
// ---------------------------------------------------------------------------

describe('merge_downtime_receipt TypeScript types', () => {
  test('Args type matches RPC parameter names', () => {
    // This test imports the generated types and checks the shape at compile time.
    // If the types file is missing the function, this import will fail.
    type MergeReceiptArgs =
      import('../../../types/database-generated.types').Database['public']['Functions']['merge_downtime_receipt']['Args']

    // Compile-time shape check via type assertion — if the field names are
    // wrong, tsc will catch it before this test even runs.
    const exampleArgs = {
      p_record_id: 'record-uuid',
      p_field: 'offload_receipts',
      p_pilot_id: 'pilot-uuid',
      p_receipt: { some: 'data' },
    } satisfies MergeReceiptArgs

    expect(exampleArgs.p_record_id).toBe('record-uuid')
    expect(exampleArgs.p_field).toBe('offload_receipts')
    expect(exampleArgs.p_pilot_id).toBe('pilot-uuid')
  })

  test('Returns type is Json', () => {
    type MergeReceiptReturns =
      import('../../../types/database-generated.types').Database['public']['Functions']['merge_downtime_receipt']['Returns']

    // Json can hold any value — just verify the type resolves without error
    const result: MergeReceiptReturns = { id: 'record-uuid', offload_receipts: {} }
    expect(result).toBeDefined()
  })
})
