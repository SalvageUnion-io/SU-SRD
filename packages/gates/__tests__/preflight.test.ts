import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RuleSet } from '../lib/ruleEngine'
import { copyTerms } from '../rules/copyTerms'
import { designTokens } from '../rules/designTokens'
import { srdCss } from '../rules/srdCss'
import { stylingOwnership } from '../rules/stylingOwnership'
import { toneGround } from '../rules/toneGround'
import { Exited, trapExit } from './trapExit'

/**
 * Each rule set's `preflight` is the hard precondition its CLI runs before
 * scanning: scan floors, and for most, workspace coverage. A preflight that
 * stopped tripping on an empty tree would let a renamed directory turn the
 * gate green forever, so each one is run against a tree with nothing in it —
 * and against this checkout, which it must accept, or `bun run check` fails.
 */

const { errors } = trapExit()

/** This checkout's root: three levels above `packages/gates/__tests__/`. */
const ROOT = join(import.meta.dir, '..', '..', '..')

const temps: string[] = []
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

function emptyTree(): string {
  const root = mkdtempSync(join(tmpdir(), 'preflight-'))
  temps.push(root)
  return root
}

/** The label its first floor names, so a CI log says which gate collapsed. */
const SETS: [RuleSet, string][] = [
  [designTokens, 'design tokens: scanned 0 files'],
  [stylingOwnership, 'styling ownership (app CSS): scanned 0 files'],
  [copyTerms, 'copy: scanned 0 files'],
  [srdCss, 'srd-css (srd source files): scanned 0 files'],
  [toneGround, 'tone-ground (header grounds): scanned 0 files'],
]

describe('rule set preflights', () => {
  for (const [set, message] of SETS) {
    test(`${set.id}: an empty tree trips the first floor instead of passing`, () => {
      expect(() => set.preflight?.(emptyTree())).toThrow(new Exited(1))
      expect(errors.join('\n')).toContain(message)
    })

    test(`${set.id}: this checkout passes every floor and coverage assertion`, () => {
      expect(() => set.preflight?.(ROOT)).not.toThrow()
      expect(errors).toEqual([])
    })
  }

  test('srd-css checks component-lib separately: a full srd tree with no library still fails', () => {
    const root = emptyTree()
    mkdirSync(join(root, 'apps/web/src'), { recursive: true })
    for (let i = 0; i < 70; i++) writeFileSync(join(root, `apps/web/src/m${i}.ts`), '')
    expect(() => srdCss.preflight?.(root)).toThrow(new Exited(1))
    expect(errors.join('\n')).toContain('srd-css (component-lib source files): scanned 0 files')
  })

  test('tone-ground reads a data directory that is not an array of entities as no grounds', () => {
    const root = emptyTree()
    mkdirSync(join(root, 'packages/salvageunion-reference/data'), { recursive: true })
    writeFileSync(join(root, 'packages/salvageunion-reference/data/meta.json'), '{"a": 1}')
    writeFileSync(join(root, 'packages/salvageunion-reference/data/notes.txt'), '')
    expect(toneGround.scan(root)).toEqual(
      Object.fromEntries(toneGround.rules.map((r) => [r.id, expect.any(Array)]))
    )
    expect(() => toneGround.preflight?.(root)).toThrow(new Exited(1))
  })
})

describe('designTokens.scan on a tree', () => {
  test('reads authored files and skips tests, generated routes and route trees', () => {
    const root = emptyTree()
    const files: Record<string, string> = {
      'apps/web/src/A.tsx': 'const c = "#ff0000"\n',
      'apps/web/src/__tests__/A.test.tsx': 'const c = "#ff0000"\n',
      'apps/web/src/B.test.ts': 'const c = "#ff0000"\n',
      'apps/web/src/routeTree.gen.ts': 'const c = "#ff0000"\n',
    }
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(join(root, rel, '..'), { recursive: true })
      writeFileSync(join(root, rel), text)
    }
    const found = designTokens.scan(root)
    expect(found['raw-color']?.map((f) => f.file)).toEqual(['apps/web/src/A.tsx'])
    expect(designTokens.summary?.(root)).toBe('1 files scanned')
  })
})
