import { describe, expect, test } from 'bun:test'
import { changelogFromLog, readChangelog } from '../gitChangelog'

const LOG = [
  '2026-10-09\tfeat(cantina,srd): release 3.0.0 (#1344)',
  '2026-10-08\tfeat(cantina): the Starter Set is read-only reference (#1114)',
  '2026-10-08\tfix(srd): mount nothing when chunk recovery swallows an import (#1108)',
  '2026-10-08\tfix(cantina)!: send an absent side as null (#1107)',
  '2026-10-07\tchore(cantina): bump a dependency (#1100)',
  '2026-10-07\tfeat: an unscoped title is no app’s (#1099)',
  '2026-10-07\tfeat(cantina-docs): a scope that only starts like the app’s (#1098)',
  '2026-10-06\tperf(cantina): a direct push with no PR number',
  'not a log line',
].join('\n')

describe('changelogFromLog', () => {
  const cantina = changelogFromLog(LOG, 'cantina', 'App')

  test('takes feat, fix and perf under the app’s own scope, one entry per day', () => {
    expect(cantina).toEqual([
      {
        date: '2026-10-09',
        area: 'App',
        items: ['release 3.0.0 ([#1344](https://github.com/SalvageUnion-io/SU-SRD/pull/1344))'],
      },
      {
        date: '2026-10-08',
        area: 'App',
        items: [
          'the Starter Set is read-only reference ([#1114](https://github.com/SalvageUnion-io/SU-SRD/pull/1114))',
          'send an absent side as null ([#1107](https://github.com/SalvageUnion-io/SU-SRD/pull/1107))',
        ],
      },
      { date: '2026-10-06', area: 'App', items: ['a direct push with no PR number'] },
    ])
  })

  test('another app’s commits never leak in', () => {
    expect(changelogFromLog(LOG, 'srd', 'Site')).toEqual([
      {
        date: '2026-10-09',
        area: 'Site',
        items: ['release 3.0.0 ([#1344](https://github.com/SalvageUnion-io/SU-SRD/pull/1344))'],
      },
      {
        date: '2026-10-08',
        area: 'Site',
        items: [
          'mount nothing when chunk recovery swallows an import ([#1108](https://github.com/SalvageUnion-io/SU-SRD/pull/1108))',
        ],
      },
    ])
  })

  test('a title naming several scopes is each of theirs, and only theirs', () => {
    expect(
      changelogFromLog('2026-10-09\tfeat(cantina,srd): both apps (#2)', 'srd', 'Site')
    ).toHaveLength(1)
    expect(changelogFromLog('2026-10-09\tfeat(cantina,srd): both apps (#2)', 'bot', 'Bot')).toEqual(
      []
    )
  })

  test('a day that comes back after an older one is still one entry, in date order', () => {
    // A squash keeps its branch's author date, so history can run 13, 12, 13.
    const log = [
      '2026-10-13\tfix(cantina): newest (#3)',
      '2026-10-12\tfix(cantina): older (#2)',
      '2026-10-13\tfix(cantina): same day, landed earlier (#1)',
    ].join('\n')
    expect(changelogFromLog(log, 'cantina', 'App').map((e) => [e.date, e.items.length])).toEqual([
      ['2026-10-13', 2],
      ['2026-10-12', 1],
    ])
  })

  test("a title from before the rename still counts as The Cantina's", () => {
    const [entry] = changelogFromLog('2026-10-01\tfeat(itun): an old title (#9)', 'cantina', 'App')
    expect(entry?.area).toBe('App')
    expect(entry?.items[0]).toStartWith('an old title ([#9]')
  })

  test('an empty log is no entries', () => {
    expect(changelogFromLog('', 'cantina', 'App')).toEqual([])
  })
})

describe('readChangelog', () => {
  test('reads this repository’s history', () => {
    for (const entry of readChangelog('cantina', 'App')) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(entry.items.length).toBeGreaterThan(0)
    }
  })
})
