import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  AREA_DIRS,
  areaRuleConstants,
  COMPONENTS_DIR,
  main,
  misplacedRules,
} from '../check-rules-home'

const ROOT = join(import.meta.dir, '..', '..')
const temps: string[] = []

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'rules-home-'))
  temps.push(root)
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), body)
  }
  return root
}

afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

describe('misplacedRules', () => {
  test('flags every non-hook .ts that is not a view-model; passes hooks, view-models, tests and components', () => {
    const root = tree({
      [`${COMPONENTS_DIR}/dashboard/dashboardRules.ts`]: '',
      [`${COMPONENTS_DIR}/dashboard/slotModels.ts`]: '',
      [`${COMPONENTS_DIR}/sheet/item.rules.ts`]: '',
      [`${COMPONENTS_DIR}/sheet/pilotInventory.ts`]: '',
      [`${COMPONENTS_DIR}/sheet/userBadge.ts`]: '',
      [`${COMPONENTS_DIR}/sheet/mechSheet.model.ts`]: '',
      [`${COMPONENTS_DIR}/dashboard/useSeat.ts`]: '',
      [`${COMPONENTS_DIR}/dashboard/__tests__/SlotRow.rules.test.tsx`]: '',
      [`${COMPONENTS_DIR}/dashboard/__tests__/fooRules.ts`]: '',
      [`${COMPONENTS_DIR}/dashboard/RulesPanel.tsx`]: '',
      [`${AREA_DIRS[0]}/sheet/crawlerRules.ts`]: '',
      [`${AREA_DIRS[1]}/usePlay.ts`]: '',
      [`${AREA_DIRS[1]}/situation.model.ts`]: '',
    })
    expect(
      misplacedRules(root)
        .problems.map((p) => p.split(' is ')[0])
        .sort()
    ).toEqual([
      `${AREA_DIRS[0]}/sheet/crawlerRules.ts`,
      `${COMPONENTS_DIR}/dashboard/dashboardRules.ts`,
      `${COMPONENTS_DIR}/dashboard/slotModels.ts`,
      `${COMPONENTS_DIR}/sheet/item.rules.ts`,
      `${COMPONENTS_DIR}/sheet/pilotInventory.ts`,
      `${COMPONENTS_DIR}/sheet/userBadge.ts`,
    ])
  })
})

describe('areaRuleConstants', () => {
  test('flags a numeric constant an area module exports; passes tests, locals and non-numbers', () => {
    const root = tree({
      [`${AREA_DIRS[1]}/mediator/setbacks.model.ts`]: 'export const SETBACK_AMOUNT = 2\n',
      [`${AREA_DIRS[0]}/prep/threat.model.ts`]: 'export const TECH_LEVEL_MAX: number = 6\n',
      [`${AREA_DIRS[1]}/tables.model.ts`]: 'const FIND_LIMIT = 6\nexport const LABEL = "x"\n',
      [`${AREA_DIRS[1]}/__tests__/fixture.ts`]: 'export const ROLL = 14\n',
    })
    expect(
      areaRuleConstants(root)
        .map((p) => p.split(' exports ')[0])
        .sort()
    ).toEqual([
      `${AREA_DIRS[0]}/prep/threat.model.ts`,
      `${AREA_DIRS[1]}/mediator/setbacks.model.ts`,
    ])
  })
})

describe('main', () => {
  test('the repo passes', () => {
    expect(
      main(
        ROOT,
        () => {},
        () => {}
      )
    ).toBe(0)
  })

  test('a plain .ts in a component folder fails it, naming the file', () => {
    const files: Record<string, string> = {
      [`${COMPONENTS_DIR}/sheet/pilotInventory.ts`]: '',
    }
    for (let i = 0; i < 300; i++) files[`${COMPONENTS_DIR}/sheet/Card${i}.tsx`] = ''
    const errors: string[] = []
    expect(
      main(
        tree(files),
        () => {},
        (line) => errors.push(line)
      )
    ).toBe(1)
    expect(errors.join('\n')).toContain(
      `${COMPONENTS_DIR}/sheet/pilotInventory.ts is neither a hook`
    )
  })

  test('a tree without the components folder fails', () => {
    expect(
      main(
        tree({ 'README.md': '' }),
        () => {},
        () => {}
      )
    ).toBe(1)
  })
})
