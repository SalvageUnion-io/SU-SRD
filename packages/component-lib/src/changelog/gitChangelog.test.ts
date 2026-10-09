import { describe, expect, test } from 'bun:test'
import { changelogFromLog, readChangelog } from './gitChangelog'

const LOG = [
  '2026-10-08\tfeat(itun): the Starter Set is read-only reference (#1114)',
  '2026-10-08\tfix(srd): mount nothing when chunk recovery swallows an import (#1108)',
  '2026-10-08\tfix(itun)!: send an absent side as null (#1107)',
  '2026-10-07\tchore(itun): bump a dependency (#1100)',
  '2026-10-07\tfeat: an unscoped title is no app’s (#1099)',
  '2026-10-07\tfeat(itun-docs): a scope that only starts like the app’s (#1098)',
  '2026-10-06\tperf(itun): a direct push with no PR number',
  'not a log line',
].join('\n')

describe('changelogFromLog', () => {
  const itun = changelogFromLog(LOG, 'itun', 'App')

  test('takes feat, fix and perf under the app’s own scope, one entry per day', () => {
    expect(itun).toEqual([
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
        date: '2026-10-08',
        area: 'Site',
        items: [
          'mount nothing when chunk recovery swallows an import ([#1108](https://github.com/SalvageUnion-io/SU-SRD/pull/1108))',
        ],
      },
    ])
  })

  test('an empty log is no entries', () => {
    expect(changelogFromLog('', 'itun', 'App')).toEqual([])
  })
})

describe('readChangelog', () => {
  test('reads this repository’s history', () => {
    for (const entry of readChangelog('itun', 'App')) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(entry.items.length).toBeGreaterThan(0)
    }
  })
})
