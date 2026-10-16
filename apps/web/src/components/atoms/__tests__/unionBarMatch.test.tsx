import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { color } from '../../../design/tokens'
import { ChapterBand } from '../ChapterBand'
import { unionBarMatchCss } from '../unionBarMatch'

/**
 * The Union bar wears the colour of the band a page leads with (the site
 * header matches the band; the footer stays ink).
 */
describe('unionBarMatchCss', () => {
  test('recolours the bar to the band, keyed on the leading band only', () => {
    const css = unionBarMatchCss('k1', color.mech, 'ink', 'ink')
    expect(css).toContain("[data-band='k1']")
    expect(css).toContain("main > .su-chapter-band[data-layout='bleed']:first-child")
    expect(css).toContain(`--su-bar-bg:${color.mech};`)
    expect(css).toContain('--su-bar-fg:var(--color-ink);')
    expect(css).toContain('--su-bar-on-fg:var(--color-paper);')
    expect(css).toContain('--su-bar-rule:transparent;')
    expect(css).toContain('--su-bar-grain-paper:none;--su-bar-grain-ink:contents}')
  })

  test('a dark band keeps paper on the bar and its paper flecks', () => {
    const css = unionBarMatchCss('k2', color.ink, 'paper', 'paper')
    expect(css).toContain('--su-bar-fg:var(--color-paper);')
    expect(css).toContain('--su-bar-grain-paper:contents;--su-bar-grain-ink:none}')
  })
})

describe('ChapterBand and the Union bar', () => {
  test('a page band serves the bar its rule, keyed by its own attribute', () => {
    const html = renderToStaticMarkup(<ChapterBand tone="mech">Mule</ChapterBand>)
    const key = /data-band="([\w-]+)"/.exec(html)?.[1]
    expect(key).toBeDefined()
    expect(html).toContain(`[data-band='${key}']`)
    expect(html).toContain(`--su-bar-bg:${color.mech}`)
  })

  test('a link-preview band never touches the bar', () => {
    const html = renderToStaticMarkup(
      <ChapterBand tone="mech" scale="og">
        Mule
      </ChapterBand>
    )
    expect(html).not.toContain('data-band=')
    expect(html).not.toContain('<style>')
  })

  test('a front page band keeps the ink bar', () => {
    const html = renderToStaticMarkup(
      <ChapterBand tone="cantina" matchBar={false}>
        The Cantina
      </ChapterBand>
    )
    expect(html).not.toContain('<style>')
  })
})
