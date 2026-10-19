import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ratchetCounts } from '../lib/ruleEngine'
import { scanSelectCss, scanSelectSources, selectMode } from '../rules/selectMode'

/**
 * The select-mode laws (hard rule R15, `packages/gates/rules/selectMode.ts`):
 * each rule against the form it forbids and the forms it must let through, so
 * a rule that silently stops matching fails here rather than going green.
 */

const scan = (rel: string, text: string) => scanSelectSources(new Map([[rel, text]]))
const lines = (found: ReturnType<typeof scan>, id: string) => found[id]?.map((f) => f.line)

describe('select-mode rule set', () => {
  test('every rule is zero', () => {
    expect(selectMode.id).toBe('select-mode')
    expect(selectMode.rules.filter((r) => r.mode !== 'zero').map((r) => r.id)).toEqual([])
    expect(ratchetCounts(selectMode, {})).toEqual({})
  })
})

describe('select-mode/picker-opacity', () => {
  const PICKER = 'apps/web/src/build/wizard/SomeStep.tsx'

  test('an opacity in a picker fails, as a style key or a utility', () => {
    const found = scan(
      PICKER,
      [
        '<Card selectionRole="radio" />',
        'const DIMMED = { opacity: 0.7 }',
        "<div className='opacity-50' />",
      ].join('\n')
    )
    expect(lines(found, 'picker-opacity')).toEqual([2, 3])
  })

  test('each select surface makes a file a picker', () => {
    for (const mark of [
      "mode={{ kind: 'select' }}",
      '<RadioCardGroup label="x">',
      '<Checkbox checked />',
      '<Radio label="x" />',
      '<input type="radio" />',
      '<EntitySearcher />',
    ]) {
      expect(lines(scan(PICKER, `${mark}\nconst A = { opacity: 0.5 }`), 'picker-opacity')).toEqual([
        2,
      ])
    }
  })

  test('a file that draws no select may dim; a transition naming opacity, a comment and a test pass', () => {
    expect(lines(scan(PICKER, 'const A = { opacity: 0.5 }'), 'picker-opacity')).toEqual([])
    const ok = [
      '<Card selectionRole="toggle" />',
      "const T = { transition: `opacity 120ms`,transitionProperty: 'opacity' }",
      '// a picker never sets opacity: 0.5',
      '/* opacity: 0.3 */',
    ].join('\n')
    expect(lines(scan(PICKER, ok), 'picker-opacity')).toEqual([])
    expect(
      lines(
        scan('apps/web/src/build/__tests__/x.test.tsx', '<RadioCardGroup />\n{ opacity: 0.5 }'),
        'picker-opacity'
      )
    ).toEqual([])
  })

  test('a stylesheet rule keyed on a pick state may not set an opacity', () => {
    const css = [
      '.a[data-unticked] { opacity: 0.6; }',
      '.b[aria-pressed="false"] { opacity: 50%; }',
      '.c:checked + span { opacity: 0.4; }',
      '.d[data-selected] { opacity: 1; }',
      '.e:hover { opacity: 0.7; }',
      '.su-select-dim { opacity: 0.5; }',
    ].join('\n')
    expect(scanSelectCss(new Map([['x.css', css]])).map((f) => f.line)).toEqual([1, 2, 3])
  })
})

describe('select-mode/level-2-seal', () => {
  test('a seal outside the level-1 forms fails', () => {
    const found = scan(
      'apps/web/src/components/referenceEntity/card/ChoiceRegion.tsx',
      '<SelectedSeal word="Chosen" />'
    )
    expect(lines(found, 'level-2-seal')).toEqual([1])
  })

  test("the Row, the Card's head, a select TitledBox, a Page's option and the searcher may seal", () => {
    for (const rel of [
      'apps/web/src/components/entity/forms/Row.tsx',
      'apps/web/src/components/referenceEntity/card/ReferenceEntityCard.tsx',
      'apps/web/src/components/containers/TitledBox.tsx',
      'apps/web/src/components/referenceEntity/choiceCard/ChoiceGroups.tsx',
      'apps/web/src/components/compositions/EntitySearcher.tsx',
    ]) {
      expect(lines(scan(rel, '<SelectedSeal />'), 'level-2-seal')).toEqual([])
    }
  })
})

describe('select-mode scan', () => {
  const temps: string[] = []
  afterAll(() => {
    for (const t of temps) rmSync(t, { recursive: true, force: true })
  })
  const tree = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'select-mode-'))
    temps.push(root)
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(join(root, rel, '..'), { recursive: true })
      writeFileSync(join(root, rel), text)
    }
    return root
  }

  test("reads the app's scripts and stylesheets, and counts its pickers", () => {
    const root = tree({
      'apps/web/src/build/Step.tsx': '<Checkbox />\nconst A = { opacity: 0.5 }\n',
      'apps/web/src/build/Plain.tsx': 'const B = { opacity: 0.5 }\n',
      'apps/web/src/build/__tests__/Step.tsx': '<Checkbox />\nconst A = { opacity: 0.5 }\n',
      'apps/web/src/styles/pick.css':
        '.a[data-selected] { opacity: 0.4; }\n.b:checked { opacity: 1; }\n',
      'apps/web/src/build/Seal.tsx': '<SelectedSeal />\n',
    })
    const found = selectMode.scan(root)
    expect(found['picker-opacity']?.map((f) => [f.file, f.line])).toEqual([
      ['apps/web/src/build/Step.tsx', 2],
      ['apps/web/src/styles/pick.css', 1],
    ])
    expect(found['level-2-seal']?.map((f) => f.file)).toEqual(['apps/web/src/build/Seal.tsx'])
    expect(selectMode.summary?.(root)).toBe('1 picker file(s) scanned')
  })
})
