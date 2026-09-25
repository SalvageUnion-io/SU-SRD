import { describe, expect, test } from 'bun:test'
import type { RosterKind, RosterRow } from '../gameRoster'
import { rosterRowStats } from '../rosterRowStats'

function row(kind: RosterKind, name: string, body: Record<string, unknown>): RosterRow {
  return {
    kind,
    serverId: `srv-${name}`,
    appId: null,
    name,
    ownerId: null,
    owner: null,
    localId: null,
    body,
    can: { openSheet: false, claim: false, release: false, scrap: false, delete: false },
  }
}

describe('rosterRowStats', () => {
  test('a pilot states a callsign only when it differs from the name', () => {
    expect(rosterRowStats(row('pilot', 'Mara', { callsign: 'Mara' }))).toEqual([])
    expect(rosterRowStats(row('pilot', 'Mara', { callsign: 'Rust' }))).toEqual([
      { label: 'Callsign', value: 'Rust' },
    ])
  })

  test('a mech with an unresolvable chassis falls back to the ref, and omits absent vitals', () => {
    // No reference data is loaded here, so the chassis lookup cannot resolve —
    // the row must still render rather than throw.
    expect(
      rosterRowStats(row('mech', 'Old Faithful', { chassisRef: 'no-such-chassis', currentSP: 7 }))
    ).toEqual([
      { label: 'Chassis', value: 'no-such-chassis' },
      { label: 'SP', value: 7 },
    ])
  })

  test('a crawler states its tech level digits and bay count; HP/AP never appear', () => {
    expect(
      rosterRowStats(row('crawler', 'Home', { techLevel: 'tech-3', crawlerBays: [{}, {}] }))
    ).toEqual([
      { label: 'TL', value: '3' },
      { label: 'Bays', value: 2 },
    ])
  })
})
