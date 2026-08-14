import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SalvageUnionReference } from 'salvageunion-reference'

/**
 * `apps/itun/convex/downtime.ts` hard-codes how many steps the Crawler Downtime
 * procedure has, because Convex deliberately has no access to
 * `salvageunion-reference` (ADR-006). A hard-coded mirror of a dataset fact is
 * exactly the kind of thing that drifts silently, so this is its gate.
 *
 * The book is the source: Core Book p.227-228 walks ten named steps, "Tally
 * Salvage" through "Prepare for the next Salvage Run".
 */
const CONVEX_MODULE = join(import.meta.dir, '..', '..', 'convex', 'downtime.ts')

function convexStepCount(): number {
  const src = readFileSync(CONVEX_MODULE, 'utf8')
  const m = src.match(/const DOWNTIME_STEP_COUNT = (\d+)/)
  if (!m?.[1]) throw new Error('DOWNTIME_STEP_COUNT not found in convex/downtime.ts')
  return Number(m[1])
}

function downtimeGuideSteps() {
  const guide = SalvageUnionReference.Guides.find((g) => g.guideType === 'downtime')
  return guide?.steps ?? []
}

describe('Convex Downtime step bound mirrors the dataset', () => {
  test('the guide is actually there (guards a vacuous pass)', () => {
    expect(downtimeGuideSteps().length).toBeGreaterThan(0)
  })

  test('the hard-coded count equals the guide’s real step count', () => {
    expect(convexStepCount()).toBe(downtimeGuideSteps().length)
  })

  test('the guide still starts and ends where the book does', () => {
    // Named rather than counted, so a step being renamed or reordered fails
    // here instead of silently changing what "step 10" means to the Mediator.
    const steps = downtimeGuideSteps()
    expect(steps[0]?.name).toBe('Tally Salvage')
    expect(steps[steps.length - 1]?.name).toBe('Prepare for the next Salvage Run')
  })
})
