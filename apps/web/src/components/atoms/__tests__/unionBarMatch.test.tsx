import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChapterBand } from '../ChapterBand'

/**
 * The site header and foot are ink-deep on every page (chrome K13): a page's
 * band serves its kind colour to what it heads, never to the bar or the foot.
 */
describe('ChapterBand and the Union bar', () => {
  test('a page band serves its kind, keyed by its own attribute, and no bar or foot colour', () => {
    const html = renderToStaticMarkup(<ChapterBand tone="mech">Mule</ChapterBand>)
    const key = /data-band="([\w-]+)"/.exec(html)?.[1]
    expect(key).toBeDefined()
    expect(html).toContain(`[data-band='${key}']`)
    expect(html).toContain('--su-kind:')
    expect(html).not.toContain('.su-union-bar{')
    expect(html).not.toContain('.su-chapter-foot{')
  })

  test('a link-preview band never touches the page', () => {
    const html = renderToStaticMarkup(
      <ChapterBand tone="mech" scale="og">
        Mule
      </ChapterBand>
    )
    expect(html).not.toContain('data-band=')
    expect(html).not.toContain('<style>')
  })
})
