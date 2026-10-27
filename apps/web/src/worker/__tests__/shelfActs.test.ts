/**
 * The account room's Shelf acts (`../shelfActs.ts`): each is told apart from
 * the solo acts, runs against the room, and answers; a refusal is the answer,
 * and sharing a pattern with a Game checks the shared database's members.
 */

import { describe, expect, test } from 'bun:test'
import { bunSql } from '../../rooms/__tests__/bunSql'
import { AccountRoomLogic } from '../../rooms/account/accountRoomLogic'
import { AT, bodies, PLAYER, stubApplyOp } from '../../rooms/game/__tests__/harness'
import type { GameActAnswer } from '../../rooms/game/acts'
import { ACCOUNT_SOCKET_ACTS, socketAct } from '../../rooms/game/socketActs'
import { migrate } from '../../rooms/migrate'
import { ACCOUNT_ROOM } from '../../rooms/schemas'
import { publishGame, testDb } from '../shared/__tests__/d1'
import { isShelfAct, runShelfAct } from '../shelfActs'

function room() {
  const sql = bunSql()
  migrate(sql, ACCOUNT_ROOM)
  const logic = new AccountRoomLogic(sql, { applyOp: stubApplyOp, newId: () => 'x' })
  logic.shelf.claim(PLAYER, AT)
  logic.shelf.create(PLAYER, { id: 'p1', kind: 'pilot', body: bodies.pilot('p1'), at: AT })
  return logic
}

const pattern = {
  id: 'pat1',
  schemaVersion: 1,
  name: 'Tow Rig',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  createdAt: new Date(AT).toISOString(),
}

const encounter = {
  id: 'enc1',
  schemaVersion: 1,
  name: 'Ambush',
  opposition: [],
  tables: [],
  notes: '',
  createdAt: new Date(AT).toISOString(),
  updatedAt: new Date(AT).toISOString(),
}

/** The act as the room's socket reads it. */
function asked(name: string, args: unknown) {
  const act = socketAct({ type: 'act', id: '1', name, args }, ACCOUNT_SOCKET_ACTS)
  if ('refusal' in act || !isShelfAct(act)) throw new Error(`${name} is not a Shelf act`)
  return act
}

/** Run one act and hear its answer. */
function run(
  logic: AccountRoomLogic,
  name: string,
  args: unknown,
  db?: Parameters<typeof runShelfAct>[1]
): Promise<GameActAnswer<unknown>> {
  return new Promise((resolve, reject) =>
    runShelfAct(logic, db, PLAYER, asked(name, args), resolve, () => reject(new Error('broken')))
  )
}

describe('the Shelf acts', () => {
  test('are told apart from the solo table’s', () => {
    const solo = socketAct(
      { type: 'act', id: '1', name: 'seats.dismount', args: { pilotId: 'p1' } },
      ACCOUNT_SOCKET_ACTS
    )
    if ('refusal' in solo) throw new Error(solo.refusal)
    expect(isShelfAct(solo)).toBe(false)
    expect(isShelfAct(asked('shelf.removeMechPattern', { patternId: 'pat1' }))).toBe(true)
  })

  test('write and remove each record kind', async () => {
    const logic = room()
    expect(await run(logic, 'shelf.upsertMechPattern', { body: pattern })).toEqual({
      ok: true,
      value: null,
    })
    await run(logic, 'shelf.upsertEncounterNpc', { body: { id: 'n1', name: 'Scav' } })
    await run(logic, 'shelf.upsertEncounter', { body: encounter })
    expect(logic.shelf.records(PLAYER, 'patterns')).toHaveLength(1)
    expect(logic.shelf.records(PLAYER, 'npcTray')).toHaveLength(1)
    expect(logic.shelf.records(PLAYER, 'encounters')).toHaveLength(1)

    await run(logic, 'shelf.removeMechPattern', { patternId: 'pat1' })
    await run(logic, 'shelf.removeEncounterNpc', { npcId: 'n1' })
    await run(logic, 'shelf.removeEncounter', { encounterId: 'enc1' })
    expect(logic.shelf.records(PLAYER, 'patterns')).toEqual([])
    expect(logic.shelf.records(PLAYER, 'npcTray')).toEqual([])
    expect(logic.shelf.records(PLAYER, 'encounters')).toEqual([])
  })

  test('share a pattern by link, then on the Reference, and a sheet by link', async () => {
    const logic = room()
    await run(logic, 'shelf.upsertMechPattern', { body: pattern })
    await run(logic, 'shelf.setPatternVisibility', { patternId: 'pat1', visibility: 'link' })
    await run(logic, 'homebrew.setShared', { patternId: 'pat1', shared: true })
    expect(logic.sharing.patternSharing(PLAYER)).toEqual([
      expect.objectContaining({
        appId: 'pat1',
        sharing: expect.objectContaining({ visibility: 'link', homebrew: true }),
      }),
    ])
    expect(
      await run(logic, 'publicSheet.setPublic', { kind: 'pilot', appId: 'p1', isPublic: true })
    ).toEqual({ ok: true, value: { isPublic: true } })
  })

  test('a Game share names a Game the player is in, or is refused', async () => {
    const logic = room()
    const db = testDb()
    await publishGame(db, 'g1', {
      name: 'The Long Haul',
      mediatedBy: 'Rosa',
      members: [{ discordId: PLAYER, mediator: false, organizer: false }],
    })
    await run(logic, 'shelf.upsertMechPattern', { body: pattern })

    expect(
      await run(logic, 'shelf.setPatternVisibility', { patternId: 'pat1', visibility: 'game' }, db)
    ).toEqual({ ok: false, refusal: 'Choose which Game to share it with' })
    expect(
      await run(
        logic,
        'shelf.setPatternVisibility',
        { patternId: 'pat1', visibility: 'game', gameId: 'g2' },
        db
      )
    ).toEqual({ ok: false, refusal: 'You are not in that Game' })
    expect(
      await run(
        logic,
        'shelf.setPatternVisibility',
        { patternId: 'pat1', visibility: 'game', gameId: 'g1' },
        undefined
      )
    ).toEqual({ ok: false, refusal: 'You are not in that Game' })

    expect(
      await run(
        logic,
        'shelf.setPatternVisibility',
        { patternId: 'pat1', visibility: 'game', gameId: 'g1' },
        db
      )
    ).toMatchObject({ ok: true })
    expect(logic.sharing.patternSharing(PLAYER)[0]?.sharing).toMatchObject({
      visibility: 'game',
      gameId: 'g1',
      gameName: 'The Long Haul',
    })
  })

  test('a defect is not an answer: the socket is told it broke', async () => {
    const logic = room()
    const broken = await new Promise<boolean>((resolve) => {
      const act = asked('shelf.upsertMechPattern', { body: pattern })
      const failing = Object.create(logic, {
        sharing: {
          value: {
            putRecord: () => {
              throw new Error('disk full')
            },
          },
        },
      }) as AccountRoomLogic
      const quiet = console.error
      console.error = () => {}
      runShelfAct(
        failing,
        undefined,
        PLAYER,
        act,
        () => resolve(false),
        () => {
          console.error = quiet
          resolve(true)
        }
      )
    })
    expect(broken).toBe(true)
  })
})
