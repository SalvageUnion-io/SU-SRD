/**
 * r4 A5 (SB4-09): at 0 SP nothing said a Critical Damage roll was due, and
 * the change was not on the Feed. A vital that reaches 0 writes a Feed line
 * and raises a toast whose button opens its table; any other change is quiet.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { toast } from 'sonner'
import type { PlayRoll } from '../playRolls.model'
import { clearPlayRolls, onPlayRoll } from '../playRolls.model'
import { onPlayTableAsked, zeroUnit, zeroVitalNotice, zeroVitalTable } from '../zeroVital.model'

const mech = { kind: 'mech', unit: { id: 'm-zero', name: 'Rig', chassisRef: 'mule' } } as const
const pilot = {
  kind: 'pilot',
  unit: { id: 'p-zero', name: 'Vex Marlow', callsign: 'Hex' },
} as const

const line = (id: string) => toast.getToasts().find((t) => t.id === id)
const press = (id: string) => {
  const t = line(id)
  const action = t && 'action' in t ? t.action : undefined
  if (action && typeof action === 'object' && 'onClick' in action)
    action.onClick({} as Parameters<typeof action.onClick>[0])
  return action !== undefined
}

describe('a vital at 0 says what happens next', () => {
  afterEach(() => {
    toast.dismiss()
    clearPlayRolls()
  })

  test('which table: Critical Damage for a Mech’s SP, Critical Injury for a Pilot’s HP, none else', () => {
    expect(zeroVitalTable(mech, 'currentSP')).toEqual({ label: 'SP', table: 'Critical Damage' })
    expect(zeroVitalTable(pilot, 'currentHP')).toEqual({ label: 'HP', table: 'Critical Injury' })
    expect(zeroVitalTable(mech, 'currentEP')).toBeNull()
    expect(zeroVitalTable(pilot, 'currentAP')).toBeNull()
  })

  test('a Mech reaching 0 SP: a Feed line, and a toast whose button asks for Critical Damage', () => {
    const heard: PlayRoll[] = []
    const asked: string[] = []
    const stopRolls = onPlayRoll((roll) => heard.push(roll))
    const stopAsked = onPlayTableAsked((name) => asked.push(name))
    try {
      zeroVitalNotice(mech, 'currentSP', 6, 0)
      expect(heard.map((r) => r.label)).toEqual(['Rig · SP 6→0 · roll on Critical Damage'])
      expect(heard[0]?.rolls).toEqual([])
      expect(press('zero:m-zero:currentSP')).toBe(true)
      expect(asked).toEqual(['Critical Damage'])
    } finally {
      stopRolls()
      stopAsked()
    }
  })

  test('a Pilot reaching 0 HP names Critical Injury, by callsign', () => {
    const heard: PlayRoll[] = []
    const stop = onPlayRoll((roll) => heard.push(roll))
    try {
      zeroVitalNotice(pilot, 'currentHP', 2, 0)
      expect(heard.map((r) => r.label)).toEqual(['Hex · HP 2→0 · roll on Critical Injury'])
    } finally {
      stop()
    }
  })

  test('with no Tables section listening the toast has no button', () => {
    zeroVitalNotice(mech, 'currentSP', 3, 0)
    expect(line('zero:m-zero:currentSP')).toBeTruthy()
    expect(press('zero:m-zero:currentSP')).toBe(false)
  })

  test('a change that does not end at 0, or began there, says nothing', () => {
    const heard: PlayRoll[] = []
    const stop = onPlayRoll((roll) => heard.push(roll))
    try {
      zeroVitalNotice(mech, 'currentSP', 6, 2)
      zeroVitalNotice(mech, 'currentSP', 0, 0)
      zeroVitalNotice(mech, 'currentEP', 4, 0)
      zeroVitalNotice(null, 'currentSP', 4, 0)
      expect(heard).toEqual([])
      expect(toast.getToasts().filter((t) => String(t.id).startsWith('zero:'))).toEqual([])
    } finally {
      stop()
    }
  })

  test('the unit is read from the store; a crawler has no such roll', () => {
    const store = {
      get: (kind: 'pilot' | 'mech', id: string) =>
        kind === 'mech' && id === 'm-zero'
          ? (mech.unit as unknown as Mech)
          : (null as Pilot | null),
    }
    expect(zeroUnit(store, 'mech', 'm-zero')?.kind).toBe('mech')
    expect(zeroUnit(store, 'pilot', 'nobody')).toBeNull()
    expect(zeroUnit(store, 'crawler', 'c1')).toBeNull()
  })
})
