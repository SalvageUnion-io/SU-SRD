import { describe, expect, it } from 'bun:test'
import { GET } from '../../pages/llms.txt'

describe('GET /llms.txt', () => {
  it('returns a text/plain response', async () => {
    const response = await GET({} as Parameters<typeof GET>[0])
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
  })

  it('includes at least 24 entity schema IDs (no drift)', async () => {
    const response = await GET({} as Parameters<typeof GET>[0])
    const text = await response.text()
    const schemaIdLines = text.split('\n').filter((line: string) => line.match(/^- `[a-z-]+` — /))
    expect(schemaIdLines.length).toBeGreaterThanOrEqual(24)
  })

  it('includes guides, tech-levels, and crawler-tech-levels (the previously missing schemas)', async () => {
    const response = await GET({} as Parameters<typeof GET>[0])
    const text = await response.text()
    expect(text).toContain('`guides`')
    expect(text).toContain('`tech-levels`')
    expect(text).toContain('`crawler-tech-levels`')
  })

  it('includes the verbatim licensing section', async () => {
    const response = await GET({} as Parameters<typeof GET>[0])
    const text = await response.text()
    expect(text).toContain(
      'Game text and mechanics are published under the Salvage Union Open Game Licence (OGL 1.0b): https://leyline.press/pages/salvage-union-open-game-licence-1-0b'
    )
    expect(text).toContain(
      'Artwork (asset_url fields) is NOT covered by the licence — used with special permission of Leyline Press; do not redistribute.'
    )
    expect(text).toContain(
      'Republication of licensed text must include the legal notices required by OGL 1.0b.'
    )
    expect(text).toContain(
      'Salvage Union is created and published by Leyline Press (https://leyline.press).'
    )
  })

  it('includes the rules content map section', async () => {
    const response = await GET({} as Parameters<typeof GET>[0])
    const text = await response.text()
    expect(text).toContain('## Rules Content Map')
    expect(text).toContain('https://salvageunion.io/schema/guides/')
    expect(text).toContain('https://salvageunion.io/schema/guides.json')
  })

  it('does not include meta schema IDs in the endpoint list', async () => {
    const response = await GET({} as Parameters<typeof GET>[0])
    const text = await response.text()
    // Meta schemas should not appear in the "Available Schema IDs" section
    expect(text).not.toContain('`actions`')
    expect(text).not.toContain('`ability-tree-requirements`')
    expect(text).not.toContain('`catalog-categories`')
  })

  it('does not reference fonts.googleapis.com or other external tracking', async () => {
    const response = await GET({} as Parameters<typeof GET>[0])
    const text = await response.text()
    expect(text).not.toContain('fonts.googleapis.com')
  })

  it('includes the standard Other Pages section', async () => {
    const response = await GET({} as Parameters<typeof GET>[0])
    const text = await response.text()
    expect(text).toContain('## Other Pages')
    expect(text).toContain('https://salvageunion.io/about/')
    expect(text).toContain('https://salvageunion.io/api/')
    expect(text).toContain('https://salvageunion.io/sitemap-index.xml')
  })
})
