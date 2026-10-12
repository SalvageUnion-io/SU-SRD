import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
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
      "import { e } from 'itun-domain/rules/e'",
    ].join('\n')
    expect(relativeSpecifiers(source)).toEqual(['./a', '../b', './c', './d'])
  })
})

describe('convexClientImports', () => {
  test('flags a Convex import of client src/, not of convex/ or a package', () => {
    const root = tree({
      [`${CONVEX_DIR}/games.ts`]:
        "import { x } from '../src/lib/rules/crafting'\nimport { y } from './model/seats'\nimport { z } from 'itun-domain/rules/downtime'",
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
  test('flags rules- and model-named modules, not view-models, tests or components', () => {
    const root = tree({
      [`${COMPONENTS_DIR}/dashboard/dashboardRules.ts`]: '',
      [`${COMPONENTS_DIR}/dashboard/slotModels.ts`]: '',
      [`${COMPONENTS_DIR}/sheet/item.rules.ts`]: '',
      [`${COMPONENTS_DIR}/sheet/mechSheet.model.ts`]: '',
      [`${COMPONENTS_DIR}/sheet/railStats.ts`]: '',
      [`${COMPONENTS_DIR}/dashboard/__tests__/SlotRow.rules.test.tsx`]: '',
      [`${COMPONENTS_DIR}/dashboard/__tests__/fooRules.ts`]: '',
      [`${COMPONENTS_DIR}/dashboard/RulesPanel.tsx`]: '',
    })
    expect(misplacedRules(root).problems.sort()).toEqual([
      `${COMPONENTS_DIR}/dashboard/dashboardRules.ts is rules-named inside components/`,
      `${COMPONENTS_DIR}/dashboard/slotModels.ts is rules-named inside components/`,
      `${COMPONENTS_DIR}/sheet/item.rules.ts is rules-named inside components/`,
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
