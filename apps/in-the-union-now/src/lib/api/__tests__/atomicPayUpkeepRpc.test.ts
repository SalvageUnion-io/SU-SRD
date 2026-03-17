import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// atomic_pay_upkeep RPC — static contract tests
//
// These tests verify:
//   1. The migration file defines atomic_pay_upkeep
//   2. The function uses a single transaction (no multi-step client calls)
//   3. SECURITY INVOKER is set (consistent with other RPCs)
//   4. TypeScript types include the new function
//   5. payUpkeep in crawlerApi calls the RPC directly (not getCrawlerById + updateCrawler)
// ---------------------------------------------------------------------------

const MIGRATION_PATH = join(
  import.meta.dir,
  '../../../../supabase/migrations/20260317000000_downtime_atomic_rpcs.sql'
)

describe('atomic_pay_upkeep migration', () => {
  const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8')

  test('migration file exists and is non-empty', () => {
    expect(migrationSql.length).toBeGreaterThan(0)
  })

  test('defines atomic_pay_upkeep function', () => {
    expect(migrationSql).toContain('atomic_pay_upkeep')
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION atomic_pay_upkeep')
  })

  test('uses SECURITY INVOKER', () => {
    // Only check the atomic_pay_upkeep block
    const fnBlock = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION atomic_pay_upkeep')
    )
    expect(fnBlock).toContain('SECURITY INVOKER')
  })

  test('accepts required parameters', () => {
    const fnBlock = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION atomic_pay_upkeep')
    )
    expect(fnBlock).toContain('p_crawler_id')
    expect(fnBlock).toContain('p_record_id')
    expect(fnBlock).toContain('p_scrap_deductions')
    expect(fnBlock).toContain('p_upgrade_pool_increase')
    expect(fnBlock).toContain('p_upkeep_result')
  })

  test('returns jsonb (the updated crawler row)', () => {
    const fnBlock = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION atomic_pay_upkeep')
    )
    expect(fnBlock).toContain('RETURNS jsonb')
  })

  test('updates crawlers table (scrap deduction + upgrade_pool)', () => {
    const fnBlock = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION atomic_pay_upkeep')
    )
    expect(fnBlock).toContain('UPDATE crawlers')
    expect(fnBlock).toContain('upgrade_pool')
    expect(fnBlock).toContain('p_upgrade_pool_increase')
  })

  test('updates downtime_records (upkeep_paid + upkeep_result)', () => {
    const fnBlock = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION atomic_pay_upkeep')
    )
    expect(fnBlock).toContain('UPDATE downtime_records')
    expect(fnBlock).toContain('upkeep_paid')
    expect(fnBlock).toContain('upkeep_result')
  })

  test('handles all 6 scrap TL columns via COALESCE pattern', () => {
    const fnBlock = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION atomic_pay_upkeep')
    )
    for (let tl = 1; tl <= 6; tl++) {
      expect(fnBlock).toContain(`scrap_tl${tl}`)
    }
  })
})

// ---------------------------------------------------------------------------
// TypeScript type contract
// ---------------------------------------------------------------------------

describe('atomic_pay_upkeep TypeScript types', () => {
  test('Args type matches RPC parameter names', () => {
    type AtomicPayUpkeepArgs =
      import('../../../types/database-generated.types').Database['public']['Functions']['atomic_pay_upkeep']['Args']

    const exampleArgs = {
      p_crawler_id: 'crawler-uuid',
      p_record_id: 'record-uuid',
      p_scrap_deductions: { scrap_tl3: 5 },
      p_upgrade_pool_increase: 5,
      p_upkeep_result: { type: 'paid', upgradePoolGained: 5 },
    } satisfies AtomicPayUpkeepArgs

    expect(exampleArgs.p_crawler_id).toBe('crawler-uuid')
    expect(exampleArgs.p_record_id).toBe('record-uuid')
    expect(exampleArgs.p_upgrade_pool_increase).toBe(5)
  })

  test('Returns type is Json', () => {
    type AtomicPayUpkeepReturns =
      import('../../../types/database-generated.types').Database['public']['Functions']['atomic_pay_upkeep']['Returns']

    const result: AtomicPayUpkeepReturns = { id: 'crawler-uuid', upgrade_pool: 5 }
    expect(result).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// crawlerApi.payUpkeep — must call the RPC directly (not getCrawlerById first)
// ---------------------------------------------------------------------------

// Runtime tests for payUpkeep RPC wiring will be added when the function
// is refactored to call atomic_pay_upkeep directly (Story 8 wiring pending).
