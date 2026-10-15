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
  test('takes feat, fix and perf under the app’s scopes, one entry per day', () => {
    expect(changelogFromLog(LOG)).toEqual([
      {
        date: '2026-10-09',
        items: ['release 3.0.0 ([#1344](https://github.com/SalvageUnion-io/SU-SRD/pull/1344))'],
      },
      {
        date: '2026-10-08',
        items: [
          'the Starter Set is read-only reference ([#1114](https://github.com/SalvageUnion-io/SU-SRD/pull/1114))',
          'mount nothing when chunk recovery swallows an import ([#1108](https://github.com/SalvageUnion-io/SU-SRD/pull/1108))',
          'send an absent side as null ([#1107](https://github.com/SalvageUnion-io/SU-SRD/pull/1107))',
        ],
      },
      { date: '2026-10-06', items: ['a direct push with no PR number'] },
    ])
  })

  test('takes the app’s own scope, `web`, and leaves another workspace’s out', () => {
    const log = [
      '2026-10-16\tfeat(web): one app (#3)',
      '2026-10-16\tfeat(bot): a command (#4)',
    ].join('\n')
    expect(changelogFromLog(log)).toEqual([
      {
        date: '2026-10-16',
        items: ['one app ([#3](https://github.com/SalvageUnion-io/SU-SRD/pull/3))'],
      },
    ])
  })

  test('a day that comes back after an older one is still one entry, in date order', () => {
    // A squash keeps its branch's author date, so history can run 13, 12, 13.
    const log = [
      '2026-10-13\tfix(cantina): newest (#3)',
      '2026-10-12\tfix(cantina): older (#2)',
      '2026-10-13\tfix(cantina): same day, landed earlier (#1)',
    ].join('\n')
    expect(changelogFromLog(log).map((e) => [e.date, e.items.length])).toEqual([
      ['2026-10-13', 2],
      ['2026-10-12', 1],
    ])
  })

  test('a title from before the rename still counts', () => {
    const [entry] = changelogFromLog('2026-10-01\tfeat(itun): an old title (#9)')
    expect(entry?.items[0]).toStartWith('an old title ([#9]')
  })

  test('an empty log is no entries', () => {
    expect(changelogFromLog('')).toEqual([])
  })
})

describe('readChangelog', () => {
  test('reads this repository’s history', () => {
    for (const entry of readChangelog()) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(entry.items.length).toBeGreaterThan(0)
    }
  })
})
