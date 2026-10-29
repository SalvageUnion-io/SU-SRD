import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { CANON_DOCS, canonFaults, gatesOf, gateTier, lawsIn } from 'gates/lib/canon'
import { CONTEXT, main } from '../check-canon'
import { fixtureTrees } from './fixtureTree'

const tree = fixtureTrees('canon')
const ROOT = join(import.meta.dir, '..', '..')

const RULESET = [
  '# Ruleset',
  '## The source',
  '1. **The book** — the source.',
  '2. **Chapter band** — a band.',
  '## The laws',
  '0. **§0 The one law** — one primitive.',
  '1. **§1 Contexts** — six.',
  '   1. **Reference** — the book.',
  '   2. **Live Sheet** — the pencil.',
  '3. **§3 Cross-cutting**',
  '   5. **§3.5 No gradients**',
  '      1. **Texture** — speckle.',
  '5. **§5 The set**',
  '   1. **Stamp** — ink. 2. **Frame** — `Box`. 3. **Badge** — chips.',
].join('\n')

const context = { rules: new Set(['tokens/raw-color']), checks: new Set(['rules-fidelity']) }

/** A repo with the five canon docs: one law each but the ruleset's, and the gates `files` adds. */
function repo(files: Record<string, string> = {}): string {
  return tree({
    [CANON_DOCS.ruleset]: '## The laws\n0. **§0 The one law** — one primitive.',
    [CANON_DOCS.chrome]: '- **K1 One ground** — once.',
    [CANON_DOCS.edl]: '- **E1** The form follows the job. **N1** nothing titled.',
    [CANON_DOCS.chips]: '- **C2b** Chips sit beside the name.',
    [CANON_DOCS.hard]: '- **R1 One Slab** — solid.',
    'apps/web/src/a.test.ts': 'test("R1 holds", () => {})',
    ...files,
  })
}

const HELD = {
  '§0': ['R1'],
  K1: ['tokens/raw-color'],
  E1: ['check:rules-fidelity'],
  N1: ['a.test.ts'],
  C2b: ['apps/web/src/a.test.ts#R1'],
  R1: ['a.test.ts'],
}

describe('lawsIn', () => {
  test('the ruleset: its Source items, then each law by its nesting, several to a line', () => {
    expect(lawsIn('ruleset', RULESET)).toEqual([
      'Source 1',
      'Source 2',
      '§0',
      '§1',
      '§1.1',
      '§1.2',
      '§3',
      '§3.5',
      '§3.5.1',
      '§5',
      '§5.1',
      '§5.2',
      '§5.3',
    ])
  })

  test('the R, K, C, E and N ids where each doc defines them, never a citation', () => {
    expect(lawsIn('hard', '- **R4 Every strip** (C2) — see R37.\n  Gate: R4.')).toEqual(['R4'])
    expect(lawsIn('chrome', '- **K10 Tabs** — K9 aside.')).toEqual(['K10'])
    expect(lawsIn('chips', '- **C1a** One Size (C8).\n- **C11** Relations.')).toEqual([
      'C1a',
      'C11',
    ])
    expect(lawsIn('edl', '- **E6** Three levels.\n  **N1** a; **N2** b (E3).')).toEqual([
      'E6',
      'N1',
      'N2',
    ])
  })
})

describe('canonFaults', () => {
  test('a canon whose every law names a gate that exists is clean', () => {
    expect(canonFaults(repo(), context, HELD)).toEqual([])
  })

  test('a law with no entry, and an entry for no law', () => {
    const { R1: _held, ...rest } = HELD
    expect(canonFaults(repo(), context, { ...rest, R9: ['a.test.ts'] })).toEqual([
      `R1 (${CANON_DOCS.hard}) names no gate: add its entry to CANON`,
      'CANON names R9, which no canon doc defines: remove it',
    ])
  })

  test('each kind of ref that resolves to nothing', () => {
    const faults = canonFaults(repo({ 'tools/b/a.test.ts': '' }), context, {
      ...HELD,
      K1: ['tokens/raw-colour'],
      E1: ['check:nope'],
      N1: ['gone.test.ts'],
      C2b: ['apps/web/src/a.test.ts#R40'],
      R1: ['a.test.ts', 'R99'],
      '§0': [],
    })
    expect(faults).toEqual([
      '§0 is held by nothing: name its gate, or cut the law',
      'K1: tokens/raw-colour is no rule-set rule',
      'E1: check:nope is no `bun run check` id',
      'N1: gone.test.ts is no gate file',
      'C2b: apps/web/src/a.test.ts holds no "R40"',
      'R1: a.test.ts names 2 files: give its path',
      'R1: R99 is no law in the canon',
    ])
  })

  test('laws that only name each other hold nothing', () => {
    expect(canonFaults(repo(), context, { ...HELD, '§0': ['R1'], R1: ['§0'] })).toEqual([
      '§0 is held only by laws that lead back to it: name a gate',
      'R1 is held only by laws that lead back to it: name a gate',
    ])
  })
})

describe('gatesOf', () => {
  test("a law's gates, through the laws it names", () => {
    expect(
      gatesOf('§0', { '§0': ['R1', 'roster.test.ts'], R1: ['chrome/slab-style', '§0'] })
    ).toEqual(['chrome/slab-style', 'roster.test.ts'])
  })
})

describe('gateTier', () => {
  test('a gate that fails no PR is nightly or pending', () => {
    const tier = gateTier(
      repo({
        'apps/web/e2e/tagged.e2e.ts':
          "import { x } from './_scan'\ntest('a', { tag: '@pr' }, () => {})",
        'apps/web/e2e/untagged.e2e.ts': "import { y } from './_night'\ntest('b', () => {})",
        'apps/web/e2e/_scan.ts': 'export const x = 1',
        'apps/web/e2e/_night.ts': 'export const y = 1',
        'apps/web/e2e/_pendingRules.ts':
          "const PENDING_RULES = {\n  align: { law: 'R40', ceiling: 3 },\n}",
        'apps/web/e2e/__tests__/scan.test.ts': 'test("x", () => {})',
      })
    )
    expect(tier('tagged.e2e.ts')).toBe('pr')
    expect(tier('_scan.ts')).toBe('pr')
    expect(tier('untagged.e2e.ts')).toBe('nightly')
    expect(tier('_night.ts')).toBe('nightly')
    expect(tier('_scan.ts#align')).toBe('pending')
    expect(tier('_pendingRules.ts#R40')).toBe('pending')
    expect(tier('scan.test.ts')).toBe('pr')
    expect(tier('tokens/raw-color')).toBe('pr')
  })
})

describe('main', () => {
  test('the repo: every law in the canon is held', () => {
    expect(main(ROOT, [], CONTEXT)).toBe(0)
  })

  test('--list prints each law and its gates, laws it names followed through', () => {
    const lines: string[] = []
    const out = { log: (line: string) => lines.push(line), error: () => {} }
    expect(main(repo(), ['--list'], context, HELD, 1, out)).toBe(0)
    expect(lines).toContain('§0        a.test.ts')
    expect(lines).toHaveLength(6)
  })

  test('a law with no gate fails, naming it', () => {
    const errors: string[] = []
    const out = { log: () => {}, error: (line: string) => errors.push(line) }
    expect(main(repo(), [], context, { ...HELD, R1: [] }, 1, out)).toBe(1)
    expect(errors[0]).toBe('✗ R1 is held by nothing: name its gate, or cut the law')
  })
})
