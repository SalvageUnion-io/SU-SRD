import { describe, test, expect, beforeEach, mock } from 'bun:test'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

type RpcResponse =
  | { data: unknown; error: null }
  | { data: null; error: { code: string; message: string } }

let rpcMock: ReturnType<typeof mock>

/**
 * Creates a fresh supabase mock that only supports `.rpc()`.
 * Each test sets `rpcMock` to control what `.rpc()` returns.
 */
function createSupabaseMock() {
  rpcMock = mock(() => Promise.resolve({ data: null, error: null }) as Promise<RpcResponse>)

  return { rpc: rpcMock }
}

// We mock the supabase module before importing the API functions.
const supabaseMock = createSupabaseMock()

mock.module('../../../lib/supabase', () => ({
  supabase: supabaseMock,
}))

// Mock modules that import from salvageunion-reference (they get called during
// createPilot / createCrawler / instantiateMechFromPattern) to avoid pulling
// in the full reference package in unit tests.
mock.module('../../../lib/entityRefUtils', () => ({
  abilityToEntityRef: (
    _pid: string,
    _uid: string,
    ref: { schema_name: string; schema_ref_id: string }
  ) => ({
    parent_id: _pid,
    parent_type: 'pilot',
    schema_name: ref.schema_name,
    schema_ref_id: ref.schema_ref_id,
    sort_order: 0,
    user_id: _uid,
  }),
  equipmentToEntityRefs: (
    _pid: string,
    _uid: string,
    refs: { schema_name: string; schema_ref_id: string }[]
  ) =>
    refs.map((ref, i) => ({
      parent_id: _pid,
      parent_type: 'pilot',
      schema_name: ref.schema_name,
      schema_ref_id: ref.schema_ref_id,
      sort_order: i + 1,
      user_id: _uid,
    })),
}))

mock.module('../../../lib/mechUtils', () => ({
  computeMechStatsFromRef: () => ({
    max_sp: 10,
    max_ep: 8,
    heat_capacity: 6,
    cargo_capacity: 4,
  }),
  patternItemsToEntityRefs: (_mid: string, _uid: string, items: unknown[]) =>
    (items as { schema_name: string; schema_ref_id: string; sort_order: number }[]).map((item) => ({
      parent_id: _mid,
      parent_type: 'mech',
      schema_name: item.schema_name,
      schema_ref_id: item.schema_ref_id,
      sort_order: item.sort_order,
      user_id: _uid,
    })),
}))

mock.module('../../../lib/crawlerUtils', () => ({
  computeCrawlerStatsFromTechLevel: () => ({
    max_sp: 20,
    upkeep: 5,
    upgrade_cost: null,
  }),
}))

mock.module('../../../lib/gameUtils', () => ({
  generateInviteCode: () => 'ABC123',
  isMediator: () => false,
  getMemberRole: () => null,
}))

mock.module('salvageunion-reference', () => ({
  PILOT_DEFAULTS: { maxHP: 6, maxAP: 4, startingTP: 0 },
  SalvageUnionReference: {
    CrawlerTechLevels: [],
    get: () => undefined,
  },
  getMaxSpBonus: () => 0,
  getWeaponSlotCount: () => 1,
}))

// Now import the API functions (they use the mocked supabase)
const { createGame } = await import('../gameApi')
const { joinGame } = await import('../gameApi')
const { createPilot } = await import('../pilotApi')
const { createCrawler } = await import('../crawlerApi')
const { updateCrawlerWeapon } = await import('../crawlerApi')
const {
  saveOffloadReceipt,
  saveRestoreReceipt,
  saveCraftReceipt,
  saveTrainingReceipt,
  saveEquipmentReceipt,
  saveCustomiseAcknowledged,
  saveRumourReceipt,
} = await import('../crawlerApi')
const { instantiateMechFromPattern } = await import('../mechApi')
const { updateMechEntityRefs } = await import('../mechApi')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the [rpcName, params] from a mock call, with loose typing for test convenience */
function getRpcCall(index: number): [string, Record<string, unknown>] {
  const call = rpcMock.mock.calls[index] as unknown as [string, Record<string, unknown>]
  return call
}

const fakeCampaign = {
  id: 'campaign-1',
  name: 'Test Campaign',
  created_by: 'user-1',
  invite_code: 'ABC123',
  archived: false,
  crawler_id: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

const fakePilot = {
  id: 'pilot-1',
  user_id: 'user-1',
  active: true,
  callsign: 'Ace',
  class_ref: 'salvager',
  hp: 6,
  max_hp: 6,
  ap: 4,
  max_ap: 4,
  tp: 0,
  background: null,
  background_used: null,
  motto: null,
  motto_used: null,
  keepsake: null,
  keepsake_used: null,
  appearance: null,
  image_path: null,
  in_downtime: false,
  injuries: null,
  is_boarded: false,
  mech_id: null,
  crawler_id: null,
  notes: null,
  visible: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

const fakeCrawler = {
  id: 'crawler-1',
  user_id: 'user-1',
  active: true,
  crawler_ref: 'hauler',
  name: 'Tin Lizzy',
  tag: null,
  max_sp: 20,
  current_sp: 20,
  tech_level: 1,
  upkeep: 5,
  upgrade_pool: 0,
  bay_npcs: {},
  notes: null,
  scrap_tl1: 0,
  scrap_tl2: 0,
  scrap_tl3: 0,
  scrap_tl4: 0,
  scrap_tl5: 0,
  scrap_tl6: 0,
  visible: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

const fakeMech = {
  id: 'mech-1',
  user_id: 'user-1',
  active: true,
  chassis_ref: 'iron-mongrel',
  pattern_name: 'Basher',
  max_sp: 10,
  current_sp: 10,
  max_ep: 8,
  current_ep: 8,
  heat_capacity: 6,
  current_heat: 0,
  cargo_capacity: 4,
  image_path: null,
  notes: null,
  source_pattern_id: null,
  source_ref_pattern_id: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

// ---------------------------------------------------------------------------
// createGame — should call RPC instead of sequential inserts
// ---------------------------------------------------------------------------

describe('createGame (RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls supabase.rpc with create_game and correct params', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeCampaign, error: null })

    const result = await createGame('user-1', 'Test Campaign')

    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('create_game', {
      p_user_id: 'user-1',
      p_name: 'Test Campaign',
      p_invite_code: 'ABC123',
    })
    expect(result).toEqual(fakeCampaign)
  })

  test('throws on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    })

    await expect(createGame('user-1', 'Test Campaign')).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// joinGame — should call RPC instead of sequential select + check + insert
// ---------------------------------------------------------------------------

describe('joinGame (RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls supabase.rpc with join_game and correct params', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeCampaign, error: null })

    const result = await joinGame('user-1', 'abc123')

    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('join_game', {
      p_user_id: 'user-1',
      p_invite_code: 'ABC123',
    })
    expect(result).toEqual(fakeCampaign)
  })

  test('uppercases invite code before passing to RPC', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeCampaign, error: null })

    await joinGame('user-1', 'abc123')

    const [, params] = getRpcCall(0)
    expect(params).toEqual(expect.objectContaining({ p_invite_code: 'ABC123' }))
  })

  test('throws on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })

    await expect(joinGame('user-1', 'BADCODE')).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// createPilot — should call RPC instead of sequential inserts
// ---------------------------------------------------------------------------

describe('createPilot (RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls supabase.rpc with create_pilot and correct params', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakePilot, error: null })

    const input = {
      callsign: 'Ace',
      class_ref: 'salvager',
      ability_ref: { schema_name: 'abilities' as const, schema_ref_id: 'ability-1' },
      equipment_refs: [
        { schema_name: 'equipment', schema_ref_id: 'eq-1' },
        { schema_name: 'equipment', schema_ref_id: 'eq-2' },
      ],
      background: 'test bg',
    }

    const result = await createPilot('user-1', input)

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [rpcName, rpcParams] = getRpcCall(0)
    expect(rpcName).toBe('create_pilot')
    expect(rpcParams.p_user_id).toBe('user-1')
    expect(rpcParams.p_callsign).toBe('Ace')
    expect(rpcParams.p_class_ref).toBe('salvager')
    expect(rpcParams.p_background).toBe('test bg')
    // Entity refs should be serialized as JSON array
    expect(Array.isArray(rpcParams.p_entity_refs)).toBe(true)
    expect(rpcParams.p_entity_refs as unknown[]).toHaveLength(3) // 1 ability + 2 equipment
    expect(result).toEqual(fakePilot)
  })

  test('passes null for optional fields when not provided', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakePilot, error: null })

    const input = {
      callsign: 'Ace',
      class_ref: 'salvager',
      ability_ref: { schema_name: 'abilities' as const, schema_ref_id: 'ability-1' },
      equipment_refs: [],
    }

    await createPilot('user-1', input)

    const [, rpcParams] = getRpcCall(0)
    expect(rpcParams.p_background).toBeNull()
    expect(rpcParams.p_motto).toBeNull()
    expect(rpcParams.p_keepsake).toBeNull()
    expect(rpcParams.p_appearance).toBeNull()
  })

  test('throws on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23503', message: 'foreign key violation' },
    })

    const input = {
      callsign: 'Ace',
      class_ref: 'salvager',
      ability_ref: { schema_name: 'abilities' as const, schema_ref_id: 'ability-1' },
      equipment_refs: [],
    }

    await expect(createPilot('user-1', input)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// createCrawler — should call RPC instead of sequential inserts + update
// ---------------------------------------------------------------------------

describe('createCrawler (RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls supabase.rpc with create_crawler and correct params', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeCrawler, error: null })

    const input = {
      crawler_ref: 'hauler',
      name: 'Tin Lizzy',
      weapon_refs: [{ schema_name: 'systems' as const, schema_ref_id: 'weapon-1' }],
    }

    const result = await createCrawler('user-1', 'game-1', input)

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [rpcName, rpcParams] = getRpcCall(0)
    expect(rpcName).toBe('create_crawler')
    expect(rpcParams.p_user_id).toBe('user-1')
    expect(rpcParams.p_game_id).toBe('game-1')
    expect(rpcParams.p_crawler_ref).toBe('hauler')
    expect(rpcParams.p_name).toBe('Tin Lizzy')
    expect(Array.isArray(rpcParams.p_weapon_refs)).toBe(true)
    expect(result).toEqual(fakeCrawler)
  })

  test('throws on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    })

    const input = { crawler_ref: 'hauler' }

    await expect(createCrawler('user-1', 'game-1', input)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// instantiateMechFromPattern — should call RPC instead of sequential ops
// ---------------------------------------------------------------------------

describe('instantiateMechFromPattern (RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls supabase.rpc with instantiate_mech and correct params', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeMech, error: null })

    const input = {
      chassis_ref: 'iron-mongrel',
      pattern_name: 'Basher',
      pattern_items: [
        { schema_name: 'systems' as const, schema_ref_id: 'sys-1', sort_order: 0 },
        { schema_name: 'modules' as const, schema_ref_id: 'mod-1', sort_order: 1 },
      ],
      source_pattern_id: 'pat-1',
    }

    const result = await instantiateMechFromPattern('user-1', 'pilot-1', input)

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [rpcName, rpcParams] = getRpcCall(0)
    expect(rpcName).toBe('instantiate_mech')
    expect(rpcParams.p_user_id).toBe('user-1')
    expect(rpcParams.p_pilot_id).toBe('pilot-1')
    expect(rpcParams.p_chassis_ref).toBe('iron-mongrel')
    expect(rpcParams.p_pattern_name).toBe('Basher')
    expect(Array.isArray(rpcParams.p_entity_refs)).toBe(true)
    expect(rpcParams.p_entity_refs).toHaveLength(2)
    expect(rpcParams.p_max_sp).toBe(10)
    expect(rpcParams.p_max_ep).toBe(8)
    expect(rpcParams.p_heat_capacity).toBe(6)
    expect(rpcParams.p_cargo_capacity).toBe(4)
    expect(result).toEqual(fakeMech)
  })

  test('throws on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23503', message: 'foreign key violation' },
    })

    const input = {
      chassis_ref: 'iron-mongrel',
      pattern_items: [],
    }

    await expect(instantiateMechFromPattern('user-1', 'pilot-1', input)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// updateMechEntityRefs — should call RPC instead of sequential delete/insert
// ---------------------------------------------------------------------------

describe('updateMechEntityRefs (RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls supabase.rpc with update_mech_entity_refs and correct params', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    const inserts = [
      {
        parent_id: 'mech-1',
        parent_type: 'mech' as const,
        schema_name: 'systems',
        schema_ref_id: 'sys-2',
        sort_order: 0,
        user_id: 'user-1',
      },
    ]

    await updateMechEntityRefs('mech-1', inserts, ['ref-old-1', 'ref-old-2'])

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [rpcName, rpcParams] = getRpcCall(0)
    expect(rpcName).toBe('update_mech_entity_refs')
    expect(rpcParams.p_mech_id).toBe('mech-1')
    expect(rpcParams.p_delete_ids).toEqual(['ref-old-1', 'ref-old-2'])
    expect(Array.isArray(rpcParams.p_inserts)).toBe(true)
    expect(rpcParams.p_inserts).toHaveLength(1)
  })

  test('handles empty deletes and inserts', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await updateMechEntityRefs('mech-1', [], [])

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [, rpcParams] = getRpcCall(0)
    expect(rpcParams.p_delete_ids).toEqual([])
    expect(rpcParams.p_inserts).toEqual([])
  })

  test('throws on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    await expect(updateMechEntityRefs('mech-1', [], ['ref-1'])).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// updateCrawlerWeapon — should call RPC instead of sequential delete/insert
// ---------------------------------------------------------------------------

describe('updateCrawlerWeapon (RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls supabase.rpc with update_crawler_weapon and correct params', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await updateCrawlerWeapon(
      'crawler-1',
      'user-1',
      'old-ref-id',
      {
        schema_name: 'systems',
        schema_ref_id: 'weapon-2',
      },
      1
    )

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [rpcName, rpcParams] = getRpcCall(0)
    expect(rpcName).toBe('update_crawler_weapon')
    expect(rpcParams.p_crawler_id).toBe('crawler-1')
    expect(rpcParams.p_user_id).toBe('user-1')
    expect(rpcParams.p_old_ref_id).toBe('old-ref-id')
    expect(rpcParams.p_new_schema_name).toBe('systems')
    expect(rpcParams.p_new_schema_ref_id).toBe('weapon-2')
    expect(rpcParams.p_sort_order).toBe(1)
  })

  test('passes null for old_ref_id when no old ref', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await updateCrawlerWeapon('crawler-1', 'user-1', null, {
      schema_name: 'systems',
      schema_ref_id: 'weapon-1',
    })

    const [, rpcParams] = getRpcCall(0)
    expect(rpcParams.p_old_ref_id).toBeNull()
  })

  test('throws on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    await expect(
      updateCrawlerWeapon('crawler-1', 'user-1', 'ref-1', {
        schema_name: 'systems',
        schema_ref_id: 'weapon-2',
      })
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Receipt save functions — should call merge_downtime_receipt RPC
// ---------------------------------------------------------------------------

const fakeDowntimeRow = {
  id: 'dt-1',
  crawler_id: 'crawler-1',
  offload_receipts: null,
  restore_receipts: null,
  craft_receipts: null,
  training_receipts: null,
  equipment_receipts: null,
  customise_acknowledged: null,
  rumour_receipts: null,
  trade_result: null,
  upkeep_paid: false,
  upkeep_result: null,
  closed_at: null,
  pre_session_started: false,
  user_id: 'user-1',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

describe('saveOffloadReceipt (merge RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls merge_downtime_receipt with offload_receipts field', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeDowntimeRow, error: null })
    const receipt = { items_offloaded: [], scrap_gained: {} }
    await saveOffloadReceipt('dt-1', 'pilot-1', receipt as never)
    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [rpcName, params] = getRpcCall(0)
    expect(rpcName).toBe('merge_downtime_receipt')
    expect(params.p_record_id).toBe('dt-1')
    expect(params.p_field).toBe('offload_receipts')
    expect(params.p_pilot_id).toBe('pilot-1')
    expect(params.p_receipt).toEqual(receipt)
  })

  test('throws on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } })
    await expect(saveOffloadReceipt('dt-1', 'pilot-1', {} as never)).rejects.toThrow()
  })
})

describe('saveRestoreReceipt (merge RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls merge_downtime_receipt with restore_receipts field', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeDowntimeRow, error: null })
    const receipt = { items_restored: [] }
    await saveRestoreReceipt('dt-1', 'pilot-1', receipt as never)
    const [rpcName, params] = getRpcCall(0)
    expect(rpcName).toBe('merge_downtime_receipt')
    expect(params.p_field).toBe('restore_receipts')
    expect(params.p_pilot_id).toBe('pilot-1')
  })
})

describe('saveCraftReceipt (merge RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls merge_downtime_receipt with craft_receipts field', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeDowntimeRow, error: null })
    const receipt = { items_crafted: [] }
    await saveCraftReceipt('dt-1', 'pilot-1', receipt as never)
    const [rpcName, params] = getRpcCall(0)
    expect(rpcName).toBe('merge_downtime_receipt')
    expect(params.p_field).toBe('craft_receipts')
  })
})

describe('saveTrainingReceipt (merge RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls merge_downtime_receipt with training_receipts field', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeDowntimeRow, error: null })
    const receipt = { tp_granted: 1, abilities_learned: [], tp_remaining: 1 }
    await saveTrainingReceipt('dt-1', 'pilot-1', receipt)
    const [rpcName, params] = getRpcCall(0)
    expect(rpcName).toBe('merge_downtime_receipt')
    expect(params.p_field).toBe('training_receipts')
    expect(params.p_receipt).toEqual(receipt)
  })
})

describe('saveEquipmentReceipt (merge RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls merge_downtime_receipt with equipment_receipts field', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeDowntimeRow, error: null })
    const receipt = { items_equipped: [] }
    await saveEquipmentReceipt('dt-1', 'pilot-1', receipt as never)
    const [rpcName, params] = getRpcCall(0)
    expect(rpcName).toBe('merge_downtime_receipt')
    expect(params.p_field).toBe('equipment_receipts')
  })
})

describe('saveCustomiseAcknowledged (merge RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls merge_downtime_receipt with customise_acknowledged field and true as receipt', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeDowntimeRow, error: null })
    await saveCustomiseAcknowledged('dt-1', 'pilot-1')
    const [rpcName, params] = getRpcCall(0)
    expect(rpcName).toBe('merge_downtime_receipt')
    expect(params.p_field).toBe('customise_acknowledged')
    expect(params.p_receipt).toBe(true)
  })
})

describe('saveRumourReceipt (merge RPC)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  test('calls merge_downtime_receipt with rumour_receipts field', async () => {
    rpcMock.mockResolvedValueOnce({ data: fakeDowntimeRow, error: null })
    const receipt = { rumour_obtained: false }
    await saveRumourReceipt('dt-1', 'pilot-1', receipt as never)
    const [rpcName, params] = getRpcCall(0)
    expect(rpcName).toBe('merge_downtime_receipt')
    expect(params.p_field).toBe('rumour_receipts')
  })
})
