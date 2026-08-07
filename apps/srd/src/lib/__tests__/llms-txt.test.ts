import { describe, expect, it } from 'bun:test'
import type { RouteContext } from '../../../ssg/types'
import { llmsTxtEndpoint } from '../../endpoints/llmsTxt'

/**
 * Was `import { GET } from '../../pages/llms.txt'` — an Astro `APIRoute`
 * returning a `Response`. The SSG contract models a non-HTML output as an
 * `EndpointModule` with a `contentType` and a `body()` returning a string, so
 * the transport wrapper is gone and the content-type is declared rather than
 * set on a header. Every assertion about the BODY below is unchanged. These
 * assertions used to be backed up by `ssg/parity.ts` holding llms.txt
 * byte-identical to the Astro build; that gate is retired, so they are now the
 * whole of what checks this endpoint.
 */
const render = () => llmsTxtEndpoint.body({} as RouteContext<Record<string, string>, unknown>)

describe('GET /llms.txt', () => {
  it('is served as text/plain', () => {
    expect(llmsTxtEndpoint.contentType).toBe('text/plain; charset=utf-8')
  })

  it('is emitted at the site root', () => {
    expect(llmsTxtEndpoint.pattern).toBe('llms.txt')
  })

  it('includes at least 24 entity schema IDs (no drift)', () => {
    const text = render()
    const schemaIdLines = text.split('\n').filter((line: string) => line.match(/^- `[a-z-]+` — /))
    expect(schemaIdLines.length).toBeGreaterThanOrEqual(24)
  })

  it('includes guides, tech-levels, and crawler-tech-levels (the previously missing schemas)', () => {
    const text = render()
    expect(text).toContain('`guides`')
    expect(text).toContain('`tech-levels`')
    expect(text).toContain('`crawler-tech-levels`')
  })

  it('includes the verbatim licensing section', () => {
    const text = render()
    expect(text).toContain(
      'Game text and mechanics are published under the Salvage Union Open Game Licence (OGL 1.0b): https://leyline.press/pages/salvage-union-open-game-licence-1-0b'
    )
    expect(text).toContain(
      'Artwork is NOT covered by the licence — used with special permission of Leyline Press; do not redistribute.'
    )
    expect(text).toContain(
      'Republication of licensed text must include the legal notices required by OGL 1.0b.'
    )
    expect(text).toContain(
      'Salvage Union is created and published by Leyline Press (https://leyline.press).'
    )
  })

  it('includes the rules content map section', () => {
    const text = render()
    expect(text).toContain('## Rules Content Map')
    expect(text).toContain('https://salvageunion.io/schema/guides/')
    expect(text).toContain('https://salvageunion.io/schema/guides.json')
  })

  it('does not include meta schema IDs in the endpoint list', () => {
    const text = render()
    // Meta schemas should not appear in the "Available Schema IDs" section
    expect(text).not.toContain('`actions`')
    expect(text).not.toContain('`ability-tree-requirements`')
    expect(text).not.toContain('`catalog-categories`')
  })

  it('does not reference fonts.googleapis.com or other external tracking', () => {
    const text = render()
    expect(text).not.toContain('fonts.googleapis.com')
  })

  it('includes the standard Other Pages section', () => {
    const text = render()
    expect(text).toContain('## Other Pages')
    expect(text).toContain('https://salvageunion.io/about/')
    expect(text).toContain('https://salvageunion.io/api/')
    expect(text).toContain('https://salvageunion.io/sitemap-index.xml')
  })
})
