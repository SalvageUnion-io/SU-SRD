import { describe, test, expect, beforeEach, mock } from 'bun:test'
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

type RpcResponse =
  | { data: unknown; error: null }
  | { data: null; error: { code: string; message: string } }

let rpcMock: ReturnType<typeof mock>

function createSupabaseMock() {
  rpcMock = mock(() => Promise.resolve({ data: null, error: null }) as Promise<RpcResponse>)
  return { rpc: rpcMock }
}

const supabaseMock = createSupabaseMock()

mock.module('../../../lib/supabase', () => ({
  supabase: supabaseMock,
}))

mock.module('salvageunion-reference', () => ({
  SalvageUnionReference: { CrawlerTechLevels: [] },
  getMaxSpBonus: () => 0,
}))

mock.module('../../../lib/crawlerUtils', () => ({
  computeCrawlerStatsFromTechLevel: () => ({ max_sp: 20, upkeep: 5, upgrade_cost: null }),
}))

const { payUpkeep } = await import('../crawlerApi')

const fakeCrawlerRow = {
  id: 'crawler-1',
  user_id: 'user-1',
  active: true,
  crawler_ref: 'hauler',
  name: 'Tin Lizzy',
  tag: null,
  max_sp: 20,
  current_sp: 20,
  tech_level: 3,
  upkeep: 5,
  upgrade_pool: 0,
  bay_npcs: {},
  notes: null,
  scrap_tl1: 0,
  scrap_tl2: 0,
  scrap_tl3: 10,
  scrap_tl4: 0,
  scrap_tl5: 0,
  scrap_tl6: 0,
  visible: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

describe('payUpkeep (atomic RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls atomic_pay_upkeep RPC with correct params', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeCrawlerRow, error: null })

    const scrapDeductions = { scrap_tl3: 5 }
    const upkeepResult = {
      type: 'paid',
      upgradePoolGained: 5,
      spLost: 0,
      bayDamagedId: null,
      bayDamagedName: null,
    }

    await payUpkeep('crawler-1', 'record-1', scrapDeductions, 5, upkeepResult)

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [rpcName, rpcParams] = rpcMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(rpcName).toBe('atomic_pay_upkeep')
    expect(rpcParams.p_crawler_id).toBe('crawler-1')
    expect(rpcParams.p_record_id).toBe('record-1')
    expect(rpcParams.p_scrap_deductions).toEqual({ scrap_tl3: 5 })
    expect(rpcParams.p_upgrade_pool_increase).toBe(5)
    expect(rpcParams.p_upkeep_result).toEqual(upkeepResult)
  })

  test('returns the updated crawler row from RPC response', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeCrawlerRow, error: null })

    const result = await payUpkeep('crawler-1', 'record-1', { scrap_tl3: 5 }, 5, {
      type: 'paid',
      upgradePoolGained: 5,
      spLost: 0,
      bayDamagedId: null,
      bayDamagedName: null,
    })

    expect(result).toEqual(fakeCrawlerRow)
  })

  test('does NOT call getCrawlerById (no read before write)', async () => {
    // The RPC replaces the client-side read-modify-write.
    // Only one RPC call should be made — no SELECT chain.
    rpcMock.mockResolvedValueOnce({ data: fakeCrawlerRow, error: null })

    await payUpkeep('crawler-1', 'record-1', { scrap_tl3: 5 }, 5, {
      type: 'paid',
      upgradePoolGained: 5,
      spLost: 0,
      bayDamagedId: null,
      bayDamagedName: null,
    })

    expect(rpcMock).toHaveBeenCalledTimes(1)
  })

  test('throws on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0002', message: 'crawlers row not found' },
    })

    await expect(
      payUpkeep('crawler-1', 'record-1', { scrap_tl3: 5 }, 5, {
        type: 'paid',
        upgradePoolGained: 5,
        spLost: 0,
        bayDamagedId: null,
        bayDamagedName: null,
      })
    ).rejects.toThrow()
  })
})
