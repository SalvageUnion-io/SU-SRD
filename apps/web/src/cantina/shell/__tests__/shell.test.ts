import { describe, expect, test } from 'bun:test'
import * as shellMeta from '../../worker/shellMeta'
import { META_END, META_START, renderShell } from '../shell'

describe('renderShell', () => {
  const html = renderShell()

  test('wraps its link-preview block in the markers the Worker swaps between', () => {
    expect([META_START, META_END]).toEqual([shellMeta.META_START, shellMeta.META_END])
    expect(html.indexOf(META_START)).toBeLessThan(html.indexOf(META_END))
    expect(html.slice(html.indexOf(META_START), html.indexOf(META_END))).toContain('og:image')
  })

  test('is a document whose one script is the source entry, with no canonical', () => {
    expect(html).toStartWith('<!doctype html>')
    expect(html.match(/<script/g)).toEqual(['<script'])
    expect(html).toContain('<script type="module" src="/src/cantina/main.tsx"></script>')
    expect(html).toContain('<div id="root"></div>')
    expect(html).not.toContain('rel="canonical"')
  })
})
