/**
 * Every write `useTableAct` sends is an act the Game room runs: a room takes
 * each under its Convex function's own name (`rooms/game/acts.ts`), so a
 * screen that starts writing a new one fails here, not at the table.
 */

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GameActName } from '../../rooms/game/acts'

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
] as const satisfies readonly GameActName[]

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('useTableAct', () => {
  test('sends only acts the Game room runs', () => {
    const sent = new Set(
      sources(join(import.meta.dir, '../..')).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/useTableAct\(\s*api\.(\w+)\.(\w+)/g)].map(
          (m) => `${m[1]}.${m[2]}`
        )
      )
    )
    expect(sent.size).toBeGreaterThan(0)
    expect([...sent].filter((name) => !(ROOM_ACTS as readonly string[]).includes(name))).toEqual([])
  })
})
