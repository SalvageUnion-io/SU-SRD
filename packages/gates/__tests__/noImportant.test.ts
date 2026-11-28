import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { codeImportantFindings, importantFindings, noImportant } from '../rules/noImportant'
import { Exited, trapExit } from './trapExit'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'important-'))
  roots.push(root)
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), contents)
  }
  return root
}

describe('no !important (ruleset §4.10)', () => {
  test('each !important in a declaration is a finding, on its line', () => {
    const css = ['.a {', '  color: red !important;', '  margin: 0 ! important;', '}'].join('\n')
    expect(importantFindings('a.css', css).map((f) => f.line)).toEqual([2, 3])
  })

  test('a comment that names it is no finding', () => {
    const css = ['/* no `!important` here', '   nor !important */', '.a { color: red; }'].join('\n')
    expect(importantFindings('a.css', css)).toEqual([])
  })

  test("code's style strings and <style> text are scanned, its comments are not", () => {
    const src = [
      "const A = { color: 'red !important' }",
      '// no !important here',
      '/* nor !important here */',
      'const css = `.a { margin: 0 !important }`',
      "const URL = 'https://example.com' // and !important in prose",
    ].join('\n')
    expect(codeImportantFindings('a.tsx', src).map((f) => f.line)).toEqual([1, 4])
  })

  test('the scan reads the stylesheets and code of the web app, never a test', () => {
    const root = fixture({
      'apps/web/src/styles/a.css': '.a { color: red !important; }',
      'apps/web/src/components/B.tsx': "export const B = { color: 'red !important' }",
      'apps/web/astro/c.astro': '<style>.c { margin: 0 !important }</style>',
      'apps/web/src/components/__tests__/B.test.tsx': "expect('x !important')",
      'apps/web/src/lib/d.test.ts': "expect('x !important')",
    })
    const files = noImportant.scan(root).important?.map((f) => f.file)
    expect(files).toEqual([
      'apps/web/src/styles/a.css',
      'apps/web/astro/c.astro',
      'apps/web/src/components/B.tsx',
    ])
    expect(noImportant.summary?.(root)).toBe('1 stylesheets and 2 code files')
  })
})

describe('no !important: the scan floor', () => {
  const { errors } = trapExit()

  test('a tree without the app’s stylesheets trips the floor instead of passing', () => {
    const root = fixture({ 'apps/web/src/styles/a.css': '.a { color: red; }' })
    expect(() => noImportant.preflight?.(root)).toThrow(new Exited(1))
    expect(errors.join('\n')).toContain('!important (stylesheets): scanned 1 files')
  })

  test('this checkout passes both floors', () => {
    expect(() => noImportant.preflight?.(join(import.meta.dir, '..', '..', '..'))).not.toThrow()
    expect(errors).toEqual([])
  })
})
