/**
 * Every write `useTableAct` sends is an act a room runs: a Game room takes
 * each under its Convex function's own name (`rooms/game/acts.ts`), and an
 * account room its Shelf's (`SHELF_ACTS`), so a screen that starts writing a
 * new one fails here, not at the table.
 */

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GameActName } from '../../rooms/game/acts'
import { SHELF_ACTS } from '../../rooms/game/socketActs'

/** The room's acts a screen may send; `satisfies` holds each to a registered name. */
const ROOM_ACTS = [
  'scenes.setConditions',
  'scenes.passHour',
  'salvageAreas.set',
  'salvageAreas.spend',
  'ledger.setFaction',
  'ledger.removeFaction',
  'ledger.setJob',
  'ledger.setJobState',
  'ledger.removeJob',
  'ledger.completeJob',
  'ledger.collectIncome',
  'safety.addBoundary',
  'safety.removeBoundary',
  'safety.showStop',
  'safety.liftStop',
  'safety.setPostToChannel',
  'mediator.addNpc',
  'mediator.removeNpc',
  'mediator.updateNpc',
  'mediator.recordGroupRoll',
  'mediator.runEncounter',
  'mediator.bringInWave',
  'mediator.endEncounter',
  'seats.board',
  'seats.dismount',
  'seats.eject',
  'seats.setRange',
  'seats.toggleEffect',
  'seats.setResolving',
  'seats.clearResolving',
  'downtime.begin',
  'downtime.advance',
  'downtime.setStep',
  'downtime.end',
  'downtime.markStepDone',
  'downtime.spendUpkeep',
  'ops.propose',
  'ops.accept',
  'ops.decline',
  'changeLog.broadcast',
  'publicSheet.setPublic',
] as const satisfies readonly GameActName[]

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('useTableAct', () => {
  test('sends only acts a room runs', () => {
    const sent = new Set(
      sources(join(import.meta.dir, '../..')).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/useTableAct\(\s*api\.(\w+)\.(\w+)/g)].map(
          (m) => `${m[1]}.${m[2]}`
        )
      )
    )
    expect(sent.size).toBeGreaterThan(0)
    const runs = new Set<string>([...ROOM_ACTS, ...Object.keys(SHELF_ACTS)])
    expect([...sent].filter((name) => !runs.has(name))).toEqual([])
  })
})
