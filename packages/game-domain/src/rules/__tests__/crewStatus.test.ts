import { describe, expect, it } from 'bun:test'
import type { Mech } from '../../schemas/mech'
import type { Pilot } from '../../schemas/pilot'
import {
  mechHasCondition,
  mechMaxima,
  mechNeedsAttention,
  mechStatus,
  pilotMaxima,
  pilotNeedsAttention,
  pilotStatus,
} from '../crewStatus'

const NOW = '2026-11-01T00:00:00.000Z'

const pilot = (overrides: Partial<Pilot> = {}): Pilot => ({
  id: 'p1',
  schemaVersion: 1,
  name: 'Ada',
  callsign: 'Wrench',
  classRef: 'engineer',
  abilities: [],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
})

const mech = (overrides: Partial<Mech> = {}): Mech => ({
  id: 'm1',
  schemaVersion: 1,
  name: 'Iron Fist',
  chassisRef: 'mule',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
})

describe('pilotMaxima', () => {
  it("adds the crew's crawler's Stat Training: Tech 3 is +4 HP and +2 AP over none", () => {
    const bare = pilotMaxima(pilot(), null)
    const trained = pilotMaxima(pilot(), { techLevel: 'tech-3' })
    expect(trained.maxHP - bare.maxHP).toBe(4)
    expect(trained.maxAP - bare.maxAP).toBe(2)
  })
})

describe('mechMaxima', () => {
  it("adds the pilot's Beefcake to the piloted mech (Mule, Tech 1: +4 SP)", () => {
    expect(mechMaxima(mech(), ['beefcake'], []).maxSP - mechMaxima(mech(), [], []).maxSP).toBe(4)
  })
})

describe('mechHasCondition', () => {
  it('reads the flag or the label, in any case', () => {
    expect(mechHasCondition(mech({ destroyed: true }), 'Destroyed')).toBe(true)
    expect(mechHasCondition(mech({ conditions: [' destroyed '] }), 'Destroyed')).toBe(true)
    expect(mechHasCondition(mech({ conditions: ['Shutdown'] }), 'Destroyed')).toBe(false)
  })
})

describe('statuses and attention', () => {
  it('a mech shut down by its condition label, overheating at its cap, a system destroyed', () => {
    const status = mechStatus(
      mech({
        conditions: ['Shutdown'],
        currentHeat: 6,
        systemConditions: { 'no-such-system': 'destroyed' },
      }),
      6
    )
    expect(status).toMatchObject({
      destroyed: false,
      shutdown: true,
      overheating: true,
      destroyedSystems: ['no-such-system'],
      destroyedModules: [],
    })
    expect(mechNeedsAttention(status)).toBe(true)
    expect(mechNeedsAttention(mechStatus(mech(), 6))).toBe(false)
  })

  it('a pilot injured or ejected needs attention; a whole one does not', () => {
    const hurt = pilotStatus(
      pilot({ injuries: [{ severity: 'minor', note: 'cracked rib' }] }),
      null,
      false
    )
    expect(hurt).toEqual({ dead: false, injured: true, ejected: false })
    expect(pilotNeedsAttention(hurt)).toBe(true)
    expect(pilotNeedsAttention(pilotStatus(pilot(), null, true))).toBe(true)
    expect(pilotNeedsAttention(pilotStatus(pilot(), null, false))).toBe(false)
  })
})
