import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  AREA_DIRS,
  COMPONENTS_DIR,
  CONVEX_DIR,
  convexClientImports,
  main,
  misplacedRules,
  relativeSpecifiers,
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

describe('relativeSpecifiers', () => {
  test('reads from, export-from, dynamic and side-effect imports; skips packages', () => {
    const source = [
      "import { a } from './a'",
      "export { b } from '../b'",
      "const c = await import('./c')",
      "import './d'",
      "import { e } from 'cantina-domain/rules/e'",
    ].join('\n')
    expect(relativeSpecifiers(source)).toEqual(['./a', '../b', './c', './d'])
  })
})

describe('convexClientImports', () => {
  test('flags a Convex import of client src/, not of convex/ or a package', () => {
    const root = tree({
      [`${CONVEX_DIR}/games.ts`]:
        "import { x } from '../src/lib/rules/crafting'\nimport { y } from './model/seats'\nimport { z } from 'cantina-domain/rules/downtime'",
      [`${CONVEX_DIR}/model/seats.ts`]: "export { w } from '../../src/components/a'",
      [`${CONVEX_DIR}/_generated/api.ts`]: "import '../../src/ignored'",
    })
    const { scanned, problems } = convexClientImports(root)
    expect(scanned).toBe(2)
    expect(problems.sort()).toEqual([
      `${CONVEX_DIR}/games.ts imports '../src/lib/rules/crafting' (client src/)`,
      `${CONVEX_DIR}/model/seats.ts imports '../../src/components/a' (client src/)`,
    ])
  })
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
    for (let i = 0; i < 30; i++) files[`${CONVEX_DIR}/m${i}.ts`] = ''
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

  test('a tree without convex/ fails', () => {
    expect(
      main(
        tree({ 'README.md': '' }),
        () => {},
        () => {}
      )
    ).toBe(1)
  })
})
