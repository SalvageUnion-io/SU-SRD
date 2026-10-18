/**
 * The Actions list's pure model (play.md §5): the order (Turn, Short, Long,
 * Reaction, Free, Downtime), what each Situation puts on hand and why the rest
 * waits, the type filter and Find, and that no action is ever unreachable:
 * every action is listed once, on hand or with its reason, in every Situation.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import type { RefMetaAction } from 'salvageunion-reference'
import { hydrateStores } from '../../components/__tests__/hydrateStores'
import type { PlayAction } from '../../lib/rules/playActions'
import type { ListEntry } from '../playActions.model'
import {
  actionTypeOf,
  buildActionList,
  filterEntries,
  lockReason,
  NEED_TEXT,
  needFor,
  splitOnHand,
} from '../playActions.model'
import type { Situation } from '../situation.model'

beforeAll(hydrateStores)

function action(
  key: string,
  actionType: string,
  currency: 'EP' | 'AP',
  extra: Partial<RefMetaAction> = {}
): PlayAction {
  return {
    key,
    name: key,
    kind: currency === 'EP' ? 'system' : 'ability',
    stamp: currency === 'EP' ? 'SYS' : 'ABL',
    currency,
    ownerName: `${key} owner`,
    slug: key,
    economy: { epCost: 1, heat: 0, maxUses: 0 },
    action: { id: key, name: key, actionType, ...extra } as RefMetaAction,
    condition: 'intact',
  }
}

const MECH = [
  action('cannon', 'Turn', 'EP'),
  action('ability', 'Short', 'EP'),
  action('repair', 'DownTime', 'EP'),
  action('brace', 'Reaction', 'EP'),
]
const PILOT = [
  action('pistol', 'Turn', 'AP'),
  action('kit', 'Long', 'AP'),
  action('dash', 'Free', 'AP'),
  action('hack', 'DownTime', 'AP'),
]

const SITUATIONS: Situation[] = ['onFoot', 'boarded', 'downtime']

function list(situation: Situation, hasMech = true): ListEntry[] {
  return buildActionList({ situation, pilotActions: PILOT, mechActions: MECH, hasMech })
}

const keys = (entries: readonly ListEntry[]) => entries.map((e) => e.key)

describe('the order', () => {
  test('by action type, Turn to Downtime, the mech’s before the pilot’s within a type', () => {
    const units = list('boarded').filter((e) => e.kind === 'action')
    expect(keys(units)).toEqual([
      'cannon',
      'pistol',
      'ability',
      'kit',
      'brace',
      'dash',
      'repair',
      'hack',
    ])
  })

  test('then the Reactor and Mount, then the Downtime actions', () => {
    expect(keys(list('boarded')).slice(-5)).toEqual([
      'reactor',
      'mount',
      'downtime:train',
      'downtime:craftTrade',
      'downtime:rumours',
    ])
  })

  test('DownTime is the book’s spelling of Downtime', () => {
    expect(actionTypeOf({ actionType: 'DownTime' } as RefMetaAction)).toBe('Downtime')
    expect(actionTypeOf({ actionType: 'Passive' } as RefMetaAction)).toBe('Passive')
    expect(actionTypeOf({} as RefMetaAction)).toBe('Other')
  })

  test('no mech, no Reactor row', () => {
    expect(keys(list('onFoot', false))).not.toContain('reactor')
    expect(keys(list('onFoot', false))).toContain('mount')
  })
})

describe('on hand, by Situation', () => {
  test('on foot: the pilot’s own; the mech’s need Boarded, Downtime’s need Downtime', () => {
    const { onHand, away } = splitOnHand(list('onFoot'))
    expect(keys(onHand)).toEqual(['pistol', 'kit', 'dash', 'mount'])
    const why = Object.fromEntries(away.map((e) => [e.key, e.need]))
    expect(why.cannon).toBe('boarded')
    expect(why.reactor).toBe('boarded')
    expect(why.hack).toBe('downtime')
    expect(why['downtime:train']).toBe('downtime')
  })

  test('Boarded: the mech’s and the pilot’s, and the Reactor', () => {
    const { onHand } = splitOnHand(list('boarded'))
    expect(keys(onHand)).toEqual([
      'cannon',
      'pistol',
      'ability',
      'kit',
      'brace',
      'dash',
      'reactor',
      'mount',
    ])
  })

  test('Downtime: the Downtime actions; the rest waits for after Downtime', () => {
    const { onHand, away } = splitOnHand(list('downtime'))
    expect(keys(onHand)).toEqual([
      'repair',
      'hack',
      'downtime:train',
      'downtime:craftTrade',
      'downtime:rumours',
    ])
    expect(new Set(away.map((e) => e.need))).toEqual(new Set(['afterDowntime']))
  })

  test('the reasons, as a row says them', () => {
    expect(NEED_TEXT[needFor('mech', 'Turn', 'onFoot') ?? 'boarded']).toBe('needs Boarded')
    expect(NEED_TEXT[needFor('pilot', 'Downtime', 'boarded') ?? 'boarded']).toBe('needs Downtime')
    expect(NEED_TEXT[needFor('pilot', 'Turn', 'downtime') ?? 'boarded']).toBe('after Downtime')
  })

  test('no action is unreachable: each is listed once, in every Situation', () => {
    const every = [...MECH, ...PILOT].map((a) => a.key).sort()
    for (const situation of SITUATIONS) {
      const units = list(situation).filter((e) => e.kind === 'action')
      expect(keys(units).sort()).toEqual(every)
      for (const entry of units) {
        if (entry.need !== null) expect(NEED_TEXT[entry.need]).toBeTruthy()
      }
    }
  })
})

describe('the filter and Find', () => {
  test('a type keeps only that type’s actions, and every control row', () => {
    const turn = filterEntries(list('boarded'), 'Turn', '')
    expect(keys(turn)).toEqual([
      'cannon',
      'pistol',
      'reactor',
      'mount',
      'downtime:train',
      'downtime:craftTrade',
      'downtime:rumours',
    ])
  })

  test('Find matches the name, the source and a control’s verbs', () => {
    expect(keys(filterEntries(list('boarded'), 'All', 'PISTOL'))).toEqual(['pistol'])
    expect(keys(filterEntries(list('boarded'), 'All', 'kit owner'))).toEqual(['kit'])
    expect(keys(filterEntries(list('boarded'), 'All', 'vent'))).toEqual(['reactor'])
    expect(keys(filterEntries(list('boarded'), 'All', 'eject'))).toEqual(['mount'])
  })
})

describe('lockReason', () => {
  test('Destroyed, out of range, over the Heat Capacity, or nothing', () => {
    const ok = action('ok', 'Turn', 'EP', { range: ['Close'] })
    expect(lockReason(ok, 'Close', { current: 0, cap: 10 })).toBeNull()
    expect(lockReason(ok, 'Far', { current: 0, cap: 10 })).toBe('Out of Range at Far')
    expect(lockReason({ ...ok, condition: 'destroyed' }, 'Close', { current: 0, cap: 10 })).toBe(
      'Destroyed'
    )
    const hot = { ...ok, economy: { epCost: 1, heat: 3, maxUses: 0 } }
    expect(lockReason(hot, 'Close', { current: 9, cap: 10 })).toBe('Over the Heat Capacity')
  })
})
