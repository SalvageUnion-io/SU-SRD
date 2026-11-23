import { describe, expect, it } from 'bun:test'
import type { StoredGamePlan } from '../gamePlan'
import { markPlayed, ownNotesFor, planFor, planWith, sessionDaysFrom } from '../gamePlan'

const plan = (sessions: StoredGamePlan['sessions']): StoredGamePlan => ({
  schemaVersion: 1,
  notes: '',
  sessions,
})

/** r8 B8 (MD8-23): ending a session marks the plan it played, so Next session moves on. */
describe('a played session plan', () => {
  const GULCH = { id: 's1', date: '2026-11-23', note: '' }
  const TOLL = { id: 's2', date: '2026-11-30', note: '' }

  it('marks the latest plan due by the day the table played', () => {
    const marked = markPlayed(plan([GULCH, TOLL]), '2026-11-23')
    expect(marked?.sessions.map((s) => s.played)).toEqual(['2026-11-23', undefined])
  })

  it('marks a plan played late, and never one dated after the day', () => {
    expect(markPlayed(plan([GULCH, TOLL]), '2026-11-25')?.sessions[0]?.played).toBe('2026-11-25')
    expect(markPlayed(plan([TOLL]), '2026-11-23')).toBeNull()
  })

  it('with nothing dated due, marks the first plan with no day', () => {
    const marked = markPlayed(plan([TOLL, { id: 's3', note: '' }]), '2026-11-23')
    expect(marked?.sessions.map((s) => s.played)).toEqual([undefined, '2026-11-23'])
  })

  it('never marks a plan twice: the next session due is the one after', () => {
    const once = markPlayed(plan([GULCH, TOLL]), '2026-11-23')
    expect(once && markPlayed(once, '2026-11-23')).toBeNull()
  })

  it('a played day is no longer a session day', () => {
    const once = markPlayed(plan([GULCH, TOLL]), '2026-11-23')
    expect(once && sessionDaysFrom(once, '2026-11-22')).toEqual(['2026-11-30'])
  })

  it('a save from a screen read before the mark keeps it', () => {
    const once = markPlayed(plan([GULCH, TOLL]), '2026-11-23')
    const saved = once && planWith(once, 'd-med', plan([{ ...GULCH, title: 'Gulch' }, TOLL]))
    expect(saved?.sessions[0]).toMatchObject({ title: 'Gulch', played: '2026-11-23' })
  })
})

/** ADR-067 §4: each member reads only the notes they wrote. */
describe('notes by author', () => {
  const S1 = { id: 's1', date: '2026-11-23', note: 'old note' }
  const legacy: StoredGamePlan = { schemaVersion: 1, notes: 'old', sessions: [S1], author: 'a' }

  it('an author reads their own notes; notes with no author yet are the table runner’s', () => {
    expect(planFor(legacy, 'a').notes).toBe('old')
    expect(planFor(legacy, 'b')).toEqual({
      schemaVersion: 1,
      notes: '',
      sessions: [{ ...S1, note: '' }],
    })
    const mine = { ...legacy, byAuthor: { b: { notes: 'mine', sessions: { s1: 'b note' } } } }
    expect(planFor(mine, 'b').sessions[0]?.note).toBe('b note')
  })

  it('reads back a former runner’s notes with their days, and nothing for one who wrote none', () => {
    expect(ownNotesFor(legacy, 'a')).toEqual({
      notes: 'old',
      sessions: [{ date: '2026-11-23', note: 'old note' }],
    })
    expect(ownNotesFor(legacy, 'b')).toBeNull()
    const undated = { ...legacy, sessions: [{ id: 's2', note: 'x' }] }
    expect(ownNotesFor(undated, 'a')?.sessions).toEqual([{ note: 'x' }])
    expect(ownNotesFor({ ...legacy, notes: '', sessions: [{ ...S1, note: '' }] }, 'a')).toBeNull()
  })
})
