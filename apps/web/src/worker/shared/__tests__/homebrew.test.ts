import { describe, expect, it } from 'bun:test'
import {
  dismissHomebrewReports,
  homebrewModeration,
  homebrewPatterns,
  homebrewStanding,
  REPORT_REASON_MAX,
  reportHomebrew,
  setHomebrewHidden,
} from '../homebrew'
import { publish, testDb } from './d1'

/** Homebrew's listing, reports and takedowns in the shared database (ADR-061). */

const TOW_RIG = {
  appId: 'pat-1',
  ownerId: 'maker',
  chassisRef: 'mule',
  name: 'Tow Rig',
  body: { name: 'Tow Rig' },
  madeBy: 'Rosa',
  sharedAt: 1,
}

/** The maker's account room, listing `homebrew`. */
const shelf = (db: ReturnType<typeof testDb>, homebrew = [TOW_RIG]) =>
  publish(db, 'account:maker', { homebrew }, 'maker')

async function listed() {
  const db = testDb()
  await shelf(db)
  return db
}

describe('reports', () => {
  it('takes one per reader, the second replacing the reason', async () => {
    const db = await listed()
    expect(
      await reportHomebrew(db, { appId: 'pat-1', reporterId: 'r-1', reason: ' rude ' }, 1)
    ).toBeNull()
    expect(
      await reportHomebrew(db, { appId: 'pat-1', reporterId: 'r-1', reason: 'stolen' }, 2)
    ).toBeNull()
    expect(
      await reportHomebrew(db, { appId: 'pat-1', reporterId: 'r-2', reason: 'rude' }, 3)
    ).toBeNull()
    const { reported } = await homebrewModeration(db)
    expect(reported).toEqual([
      {
        appId: 'pat-1',
        name: 'Tow Rig',
        madeBy: 'Rosa',
        reportCount: 2,
        reasons: ['rude', 'stolen'],
        hiddenAt: null,
      },
    ])
    expect((await homebrewStanding(db, 'pat-1', 'r-1')).reported).toBe(true)
    expect((await homebrewStanding(db, 'pat-1', 'r-3')).reported).toBe(false)
  })

  it('refuses your own, an empty or overlong reason, and an unlisted pattern', async () => {
    const db = await listed()
    const report = (reporterId: string, reason: string, appId = 'pat-1') =>
      reportHomebrew(db, { appId, reporterId, reason })
    expect(await report('maker', 'mine')).toBe('own')
    expect(await report('r-1', '   ')).toBe('empty')
    expect(await report('r-1', 'x'.repeat(REPORT_REASON_MAX + 1))).toBe('too-long')
    expect(await report('r-1', 'rude', 'pat-9')).toBe('not-listed')
  })

  it('a dismissal clears them', async () => {
    const db = await listed()
    await reportHomebrew(db, { appId: 'pat-1', reporterId: 'r-1', reason: 'rude' })
    expect((await homebrewModeration(db)).reported[0]?.reportCount).toBe(1)
    await dismissHomebrewReports(db, 'pat-1')
    expect((await homebrewModeration(db)).reported).toEqual([])
  })
})

describe('a takedown', () => {
  it('settles the reports and takes it off the listing', async () => {
    const db = await listed()
    await reportHomebrew(db, { appId: 'pat-1', reporterId: 'r-1', reason: 'rude' })
    await setHomebrewHidden(db, 'pat-1', true, 5)
    expect(await homebrewPatterns(db)).toEqual([])
    const queue = await homebrewModeration(db)
    expect(queue.reported).toEqual([])
    expect(queue.hidden.map((m) => [m.appId, m.reportCount, m.hiddenAt])).toEqual([['pat-1', 0, 5]])
    expect(await homebrewStanding(db, 'pat-1', null)).toEqual({
      listed: false,
      hidden: true,
      reported: false,
      ownerId: 'maker',
    })
  })

  it('outlives unsharing and sharing again, until an admin puts it back', async () => {
    const db = await listed()
    await setHomebrewHidden(db, 'pat-1', true)
    await shelf(db, [])
    await shelf(db)
    expect(await homebrewPatterns(db)).toEqual([])
    await setHomebrewHidden(db, 'pat-1', false)
    expect((await homebrewPatterns(db)).map((r) => r.appId)).toEqual(['pat-1'])
  })
})
