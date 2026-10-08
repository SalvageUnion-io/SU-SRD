import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { api } from '../../convex/_generated/api'
import { makeUser } from './assignmentFixtures'
import { testConvex } from './harness'

/**
 * Convex reads how many steps the Crawler Downtime procedure has from the
 * dataset's guide (`convex/model/referenceData.ts`), the one `DowntimeWizard`
 * renders. It used to hard-code the count, and this file compared the constant
 * with the guide; now the server reads the guide itself, so what is left to
 * check is that it does, and that the guide is still the book's.
 *
 * The book is the source: Core Book p.227-228 walks ten named steps, "Tally
 * Salvage" through "Prepare for the next Salvage Run".
 */

function downtimeGuideSteps() {
  const guide = SalvageUnionReference.Guides.find((g) => g.guideType === 'downtime')
  return guide?.steps ?? []
}

describe('Convex Downtime steps come from the dataset', () => {
  test('the guide is actually there (guards a vacuous pass)', () => {
    expect(downtimeGuideSteps().length).toBeGreaterThan(0)
  })

  test('advancing stops at the guide’s last step', async () => {
    const t = testConvex()
    const gm = await makeUser(t, 'Mediator')
    const gameId = await gm.as.mutation(api.games.create, { name: 'Tenacity' })
    await gm.as.mutation(api.games.setMediator, { gameId, userId: gm.userId, mediator: true })

    await gm.as.mutation(api.downtime.begin, { gameId })
    const steps = downtimeGuideSteps().length
    for (let i = 0; i < steps + 3; i++) await gm.as.mutation(api.downtime.advance, { gameId })
    expect((await gm.as.query(api.downtime.state, { gameId })).stepIndex).toBe(steps - 1)
  })

  test('the guide still starts and ends where the book does', () => {
    // Named rather than counted, so a step being renamed or reordered fails
    // here instead of silently changing what "step 10" means to the Mediator.
    const steps = downtimeGuideSteps()
    expect(steps).toHaveLength(10)
    expect(steps[0]?.name).toBe('Tally Salvage')
    expect(steps[steps.length - 1]?.name).toBe('Prepare for the next Salvage Run')
  })
})
