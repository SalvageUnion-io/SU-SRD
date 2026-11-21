/**
 * A mech built from a pattern counts on it, in its maker's room
 * (`patternBuilds.ts`): which acts name a pattern, and where one build is
 * counted. A forged id counts nowhere, and a failure never reaches the builder.
 */

import { describe, expect, spyOn, test } from 'bun:test'
import { bunSql } from '../../rooms/__tests__/bunSql'
import { seedShelf } from '../../rooms/account/__tests__/seedShelf'
import { AccountRoomLogic } from '../../rooms/account/accountRoomLogic'
import { AT, bodies, PLAYER, stubApplyOp } from '../../rooms/game/__tests__/harness'
import { migrate } from '../../rooms/migrate'
import { ACCOUNT_ROOM } from '../../rooms/schemas'
import { builtMech, countPatternBuild } from '../patternBuilds'
import type { SharedDb } from '../shared/db'

function shelf(): AccountRoomLogic {
  const sql = bunSql()
  migrate(sql, ACCOUNT_ROOM)
  let ids = 0
  const room = new AccountRoomLogic(sql, { applyOp: stubApplyOp, newId: () => `a-${++ids}` })
  seedShelf(
    room,
    {
      owner: PLAYER,
      name: 'Player',
      units: [{ kind: 'mech', id: 'm1', body: bodies.mech('m1') as Record<string, unknown> }],
      links: [],
      seats: [],
      records: [],
    },
    AT
  )
  return room
}

describe('the pattern a new mech is built from', () => {
  test('is the one its body names', () => {
    const args = { id: 'm2', kind: 'mech', body: { sourcePattern: 'pat-1' } }
    expect(builtMech(shelf(), args)).toBe('pat-1')
  })

  test('is none for a mech that names no pattern, a pilot, or a mech already on the Shelf', () => {
    const room = shelf()
    expect(builtMech(room, { id: 'm2', kind: 'mech', body: {} })).toBeNull()
    expect(builtMech(room, { id: 'm2', kind: 'mech', body: { sourcePattern: '' } })).toBeNull()
    expect(builtMech(room, { id: 'm2', kind: 'mech', body: { sourcePattern: 7 } })).toBeNull()
    expect(builtMech(room, { id: 'm2', kind: 'mech', body: null })).toBeNull()
    expect(
      builtMech(room, { id: 'p2', kind: 'pilot', body: { sourcePattern: 'pat-1' } })
    ).toBeNull()
    // Saving the mech again is not building it again.
    expect(builtMech(room, { id: 'm1', kind: 'mech', body: { sourcePattern: 'pat-1' } })).toBeNull()
    expect(builtMech(room, { kind: 'mech', body: { sourcePattern: 'pat-1' } })).toBeNull()
  })
})

describe('counting one build', () => {
  /** A shared database that says `maker` shared the pattern with whoever asks (null: nobody did). */
  const sharedBy = (maker: string | null): SharedDb =>
    ({
      prepare: () => ({
        bind: () => ({ first: async () => (maker === null ? null : { owner_id: maker }) }),
      }),
    }) as never

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  /** A room that holds the pattern or does not, recording what it counted. */
  function counter(holds: boolean) {
    const counted: string[] = []
    return {
      counted,
      countBuild: (patternId: string, builder: string) => {
        if (holds) counted.push(`${patternId} by ${builder}`)
        return holds
      },
    }
  }

  test('the builder’s own pattern counts here, and nowhere else is asked', async () => {
    const here = counter(true)
    const asked: string[] = []
    countPatternBuild(
      here,
      sharedBy('d-maker'),
      (maker) => {
        asked.push(maker)
        return { countBuild: async () => true }
      },
      'pat-1',
      'd-builder'
    )
    await settle()
    expect(here.counted).toEqual(['pat-1 by d-builder'])
    expect(asked).toEqual([])
  })

  test('a pattern somebody shared with the builder counts in its maker’s room', async () => {
    const makers = counter(true)
    const asked: string[] = []
    countPatternBuild(
      counter(false),
      sharedBy('d-maker'),
      (maker) => {
        asked.push(maker)
        return { countBuild: async (id, builder) => makers.countBuild(id, builder) }
      },
      'pat-1',
      'd-builder'
    )
    await settle()
    expect(asked).toEqual(['d-maker'])
    expect(makers.counted).toEqual(['pat-1 by d-builder'])
  })

  test('a forged id nobody shared, or one the database says is the builder’s own, counts nowhere else', async () => {
    for (const maker of [null, 'd-builder']) {
      const asked: string[] = []
      countPatternBuild(
        counter(false),
        sharedBy(maker),
        (home) => {
          asked.push(home)
          return { countBuild: async () => true }
        },
        'pat-forged',
        'd-builder'
      )
      await settle()
      expect(asked).toEqual([])
    }
  })

  test('with no shared database, a pattern that is not here counts nowhere', async () => {
    const asked: string[] = []
    countPatternBuild(
      counter(false),
      undefined,
      (maker) => {
        asked.push(maker)
        return { countBuild: async () => true }
      },
      'pat-1',
      'd-builder'
    )
    await settle()
    expect(asked).toEqual([])
  })

  test('a failure is logged and never thrown at the builder', async () => {
    const errors = spyOn(console, 'error').mockImplementation(() => {})
    const broken = {
      countBuild: () => {
        throw new Error('room down')
      },
    }
    expect(() =>
      countPatternBuild(
        broken,
        undefined,
        () => ({ countBuild: async () => true }),
        'pat-1',
        'd-builder'
      )
    ).not.toThrow()
    await settle()
    expect(errors).toHaveBeenCalledTimes(1)
    expect(errors.mock.calls[0]?.[1]).toBe('pat-1')
    errors.mockRestore()
  })
})
