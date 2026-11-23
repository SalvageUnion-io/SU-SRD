import { describe, expect, test } from 'bun:test'
import { sessionPlans } from '../useNextSession'

/** r7 C10 (MD7-09): a plan whose day has passed reads "Last session", never "Next session". */
describe('the plans a recap names', () => {
  const GULCH = { title: 'The Gulch', date: '2026-11-23' }
  const TOLL = { title: 'Toll gate', date: '2026-11-30' }

  test('before the table plays, today’s plan is next', () => {
    expect(sessionPlans([GULCH, TOLL], [], '2026-11-23', '2026-11-16')).toMatchObject({
      next: expect.stringContaining('The Gulch'),
      last: null,
    })
  })

  test('once today’s session has ended, today’s plan is the last one and the next is after it', () => {
    const plans = sessionPlans([GULCH, TOLL], [], '2026-11-23', '2026-11-23')
    expect(plans.last).toContain('The Gulch')
    expect(plans.next).toContain('Toll gate')
  })

  test('a plan whose day passed is the last session', () => {
    expect(sessionPlans([GULCH], [], '2026-11-25', null)).toMatchObject({
      next: null,
      last: expect.stringContaining('The Gulch'),
    })
  })
})
