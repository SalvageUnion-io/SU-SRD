import { describe, expect, test } from 'bun:test'
import { codeImportantFindings, importantFindings } from '../rules/noImportant'

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
})
