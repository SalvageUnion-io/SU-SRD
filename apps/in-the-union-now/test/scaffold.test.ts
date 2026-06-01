// Wave 0 scaffold smoke test — updated in Wave 1 to reflect real schema exports.
// The placeholderSchema has been replaced by concrete Pilot/Mech/Crawler/Workspace/SoftLink schemas.
import { describe, expect, it } from 'bun:test'

import { PilotSchema } from '../src/lib/schemas/index'
import { useAppStore } from '../src/stores/index'

describe('Wave 0 scaffold', () => {
  it('exports PilotSchema (replaces placeholderSchema)', () => {
    const result = PilotSchema.safeParse({
      id: 'test',
      schemaVersion: 1,
      name: 'Test',
      callsign: 'T',
      classRef: 'scavenger',
      abilities: [],
      equipment: [],
      rollResults: [],
      motto: '',
      keepsake: '',
      appearance: '',
      conditions: [],
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('exports useAppStore with initial state', () => {
    const state = useAppStore.getState()
    expect(state.initialized).toBe(false)
  })
})
