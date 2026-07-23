import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { MarkdownSection } from './MarkdownSection'
import { parseMarkdownSection } from './parseMarkdownSection'

afterEach(cleanup)

/** The repo-root prose documents both about pages render. */
const DOCS = ['ABOUT_JRVS.md', 'LLM_STATEMENT.md'].map((name) => ({
  name,
  markdown: readFileSync(join(import.meta.dir, '../../../..', name), 'utf8'),
}))

describe('parseMarkdownSection', () => {
  test('drops the HTML comment header and reads each heading', () => {
    const headings = DOCS.map((doc) => parseMarkdownSection(doc.markdown).heading)
    expect(headings).toEqual(['About the Dev', 'LLM Statement'])
  })

  test('joins soft-wrapped prose into one paragraph per block', () => {
    const { paragraphs } = parseMarkdownSection('# Head\n\nfirst line\nsecond line\n\nnext block\n')
    expect(paragraphs).toEqual(['first line second line', 'next block'])
  })

  test('tolerates a file with no heading', () => {
    expect(parseMarkdownSection('just prose')).toEqual({ heading: '', paragraphs: ['just prose'] })
  })

  test('drops a multi-line comment block even when blank lines split it', () => {
    const { heading, paragraphs } = parseMarkdownSection(
      '<!--\n  note\n\n  more note\n-->\n\n# Head\n\nbody\n'
    )
    expect(heading).toBe('Head')
    expect(paragraphs).toEqual(['body'])
  })

  test('never partially removes a comment span, so nothing can be spliced', () => {
    // A single `<!--[\s\S]*?-->` replace turns this into a fresh `<!--`, by
    // cutting the inner span out and joining the text either side of it. Whole
    // lines are kept or dropped here, so the line survives verbatim and is
    // rendered as literal text.
    const line = '<!<!-- comment -->-- still here'
    expect(parseMarkdownSection(line).paragraphs).toEqual([line])
  })
})

describe('the repo-root prose documents', () => {
  // The renderer does not interpret inline markdown (see each file's own header
  // comment), so syntax added there would ship as literal punctuation.
  test.each(DOCS)('$name is plain paragraphs — no links, bold, or bullets', ({ markdown }) => {
    const { paragraphs } = parseMarkdownSection(markdown)
    expect(paragraphs.length).toBeGreaterThan(0)
    for (const paragraph of paragraphs) {
      expect(paragraph).not.toMatch(/\[[^\]]*]\(|\*\*|^[-*]\s|^#/)
    }
  })
})

describe('MarkdownSection', () => {
  test.each(DOCS)('renders the $name heading and every paragraph', ({ markdown }) => {
    const { heading, paragraphs } = parseMarkdownSection(markdown)
    render(<MarkdownSection markdown={markdown} />)

    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    for (const paragraph of paragraphs) {
      expect(screen.getByText(paragraph)).toBeTruthy()
    }
  })

  test('omits the heading element when the markdown has none', () => {
    render(<MarkdownSection markdown="body only" />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('body only')).toBeTruthy()
  })
})
