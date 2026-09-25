import { describe, expect, test } from 'bun:test'
import { GENERATED_PATHS, parsePorcelain } from '../check-generated'

describe('check-generated', () => {
  test('a modified file and an untracked NEW file are both drift', () => {
    // The CI-10 gap: `git diff` alone never saw a generator emitting a new file.
    const drift = parsePorcelain(
      ' M packages/salvageunion-reference/schemas/a.json\n?? packages/salvageunion-reference/schemas/new.json\n'
    )
    expect(drift).toEqual({
      changed: ['packages/salvageunion-reference/schemas/a.json'],
      untracked: ['packages/salvageunion-reference/schemas/new.json'],
    })
  })

  test('the route tree is covered, not only the reference package', () => {
    expect(GENERATED_PATHS).toContain('apps/itun/src/routeTree.gen.ts')
  })
})
