import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { color } from '../../../design/tokens'
import { ChapterBand } from '../ChapterBand'
import { footerMatchCss, unionBarMatchCss } from '../unionBarMatch'

/**
 * The Union bar wears the colour of the band a page leads with, and so does
 * the site footer (owner's call, 2026-10-19).
 */
describe('unionBarMatchCss', () => {
  test('recolours the bar to the band, keyed on the leading band only', () => {
    const css = unionBarMatchCss('k1', color.mech, 'ink', 'ink')
    expect(css).toContain("[data-band='k1']")
    expect(css).toContain("main > .su-chapter-band[data-layout='bleed']:first-child")
    expect(css).toContain(`--su-bar-bg:${color.mech};`)
    expect(css).toContain('--su-bar-fg:var(--color-ink);')
    expect(css).toContain('--su-bar-on-fg:var(--color-paper);')
    expect(css).toContain('--su-bar-grain-paper:none;--su-bar-grain-ink:contents}')
  })

  test('the bar matches in every mode: no mode is left out', () => {
    const css = unionBarMatchCss('k3', color.mech, 'ink', 'ink')
    expect(css).toContain(' .su-union-bar{')
    expect(css).not.toContain('data-mode')
  })

  test('a dark band keeps paper on the bar and its paper flecks', () => {
    const css = unionBarMatchCss('k2', color.ink, 'paper', 'paper')
    expect(css).toContain('--su-bar-fg:var(--color-paper);')
    expect(css).toContain('--su-bar-grain-paper:contents;--su-bar-grain-ink:none}')
  })
})

// Rulings 2 and 4 (2026-10-19): the footer matches the leading band, as the bar does.
describe('footerMatchCss', () => {
  test('recolours the foot band to the band, keyed on the same leading band', () => {
    const css = footerMatchCss('k1', color.mech, 'ink', 'ink')
    expect(css).toContain("[data-band='k1']")
    expect(css).toContain("main > .su-chapter-band[data-layout='bleed']:first-child")
    expect(css).toContain(' .su-chapter-foot{')
    expect(css).toContain(`--su-foot-bg:${color.mech};`)
    expect(css).toContain('--su-foot-fg:var(--color-ink);')
    // The black mark stays black on a band that prints ink.
    expect(css).toContain('--su-foot-mark:none;')
    expect(css).toContain('--su-foot-grain-paper:none;--su-foot-grain-ink:contents}')
  })

  test('a dark band prints paper, reverses the mark and shows its paper flecks', () => {
    const css = footerMatchCss('k2', color.denizenBand, 'paper', 'paper')
    expect(css).toContain('--su-foot-fg:var(--color-paper);')
    expect(css).toContain('--su-foot-mark:invert(1);')
    expect(css).toContain('--su-foot-grain-paper:contents;--su-foot-grain-ink:none}')
  })

  test("a page band serves the footer its rule beside the bar's", () => {
    const html = renderToStaticMarkup(<ChapterBand tone="pilot">Abilities</ChapterBand>)
    expect(html).toContain('.su-chapter-foot{')
    expect(html).toContain(`--su-foot-bg:${color.pilot}`)
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

  test('a front page band colours the bar too', () => {
    const html = renderToStaticMarkup(<ChapterBand tone="build">Training Bay</ChapterBand>)
    expect(html).toContain('<style>')
  })
})
