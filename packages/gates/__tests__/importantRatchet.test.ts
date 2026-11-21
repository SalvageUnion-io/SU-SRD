import { describe, expect, test } from 'bun:test'
import { HELD, importantFindings, overHeld } from '../rules/importantRatchet'

describe('the !important ratchet (ruleset §4.10)', () => {
  test('each !important in a declaration is a finding, on its line', () => {
    const css = ['.a {', '  color: red !important;', '  margin: 0 ! important;', '}'].join('\n')
    expect(importantFindings('a.css', css).map((f) => f.line)).toEqual([2, 3])
  })

  test('a comment that names it is no finding', () => {
    const css = ['/* no `!important` here', '   nor !important */', '.a { color: red; }'].join('\n')
    expect(importantFindings('a.css', css)).toEqual([])
  })

  test('a stylesheet over its held count is a finding, one under it must lower the count', () => {
    const css = '.a { color: red !important; }'
    const held = Object.entries(HELD).flatMap(([file, n]) =>
      Array.from({ length: n }, () => importantFindings(file, css)).flat()
    )
    expect(overHeld(held)).toEqual([])
    const added = overHeld([...held, ...importantFindings('apps/web/src/styles/new.css', css)])
    expect(added.map((f) => f.file)).toEqual(['apps/web/src/styles/new.css'])
    expect(overHeld(held.slice(1)).map((f) => f.detail)).toEqual([
      expect.stringContaining('lower it'),
    ])
  })
})
