import { describe, test, expect, beforeEach, mock } from 'bun:test'

// ---------------------------------------------------------------------------
// Supabase mock — supports .from().update().eq().select().single() chain
// ---------------------------------------------------------------------------

type MockChain = {
  update: ReturnType<typeof mock>
  eq: ReturnType<typeof mock>
  select: ReturnType<typeof mock>
  single: ReturnType<typeof mock>
}

let chain: MockChain

function createSupabaseMock() {
  chain = {
    single: mock(() => Promise.resolve({ data: null, error: null })),
    select: mock(() => chain),
    eq: mock(() => chain),
    update: mock(() => chain),
  }

  return {
    from: mock(() => chain),
  }
}

const supabaseMock = createSupabaseMock()

mock.module('../../../lib/supabase', () => ({
  supabase: supabaseMock,
}))

const { updateSessionState } = await import('../gameApi')

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fakeCampaign = {
  id: 'campaign-1',
  name: 'Test Campaign',
  created_by: 'user-1',
  invite_code: 'ABC123',
  archived: false,
  crawler_id: null,
  session_state: { round_number: 1, initiative_winner: 'players', active_encounter_id: null },
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

// ---------------------------------------------------------------------------
// updateSessionState — calls supabase.from('campaigns').update(...).eq(...).select().single()
// ---------------------------------------------------------------------------

describe('updateSessionState', () => {
  beforeEach(() => {
    chain.single.mockReset()
    chain.single.mockResolvedValue({ data: fakeCampaign, error: null })
    chain.select.mockReset()
    chain.select.mockReturnValue(chain)
    chain.eq.mockReset()
    chain.eq.mockReturnValue(chain)
    chain.update.mockReset()
    chain.update.mockReturnValue(chain)
    ;(supabaseMock.from as ReturnType<typeof mock>).mockReset()
    ;(supabaseMock.from as ReturnType<typeof mock>).mockReturnValue(chain)
  })

  test('calls update on campaigns table with merged session_state', async () => {
    const existingState = {
      round_number: 0,
      initiative_winner: null as null,
      active_encounter_id: null as null,
    }
    const result = await updateSessionState('campaign-1', existingState, { round_number: 1 })

    expect(supabaseMock.from).toHaveBeenCalledWith('campaigns')
    expect(chain.update).toHaveBeenCalledWith({
      session_state: {
        round_number: 1,
        initiative_winner: null,
        active_encounter_id: null,
      },
    })
    expect(chain.eq).toHaveBeenCalledWith('id', 'campaign-1')
    expect(chain.select).toHaveBeenCalled()
    expect(chain.single).toHaveBeenCalled()
    expect(result).toEqual(fakeCampaign)
  })

  test('merges initiative_winner without clobbering round_number', async () => {
    const existingState = {
      round_number: 3,
      initiative_winner: null as null,
      active_encounter_id: null as null,
    }
    await updateSessionState('campaign-1', existingState, { initiative_winner: 'npcs' })

    expect(chain.update).toHaveBeenCalledWith({
      session_state: {
        round_number: 3,
        initiative_winner: 'npcs',
        active_encounter_id: null,
      },
    })
  })

  test('handles null existing state — uses defaults before merging', async () => {
    await updateSessionState('campaign-1', null, { round_number: 2 })

    expect(chain.update).toHaveBeenCalledWith({
      session_state: {
        round_number: 2,
        initiative_winner: null,
        active_encounter_id: null,
      },
    })
  })

  test('throws on Supabase error', async () => {
    chain.single.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })

    await expect(updateSessionState('campaign-1', null, { round_number: 1 })).rejects.toThrow()
  })
})
