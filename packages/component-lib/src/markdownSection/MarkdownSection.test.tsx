import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MarkdownSection } from './MarkdownSection'
import { parseInline, parseMarkdownSection } from './parseMarkdownSection'

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

describe('parseInline', () => {
  test('splits a paragraph into text runs and links', () => {
    expect(parseInline('see [the site](https://alxjrvs.com) for more')).toEqual([
      { text: 'see ' },
      { text: 'the site', href: 'https://alxjrvs.com' },
      { text: ' for more' },
    ])
  })

  test('leaves a paragraph with no link as one run', () => {
    expect(parseInline('plain prose')).toEqual([{ text: 'plain prose' }])
  })

  test('keeps a non-http target as literal text', () => {
    // A `javascript:` href must never become a live link.
    expect(parseInline('[x](javascript:alert(1))')).toEqual([
      { text: '[' },
      { text: 'x](javascript:alert(1))' },
    ])
  })

  test('keeps an unclosed bracket as literal text', () => {
    expect(parseInline('a [ b')).toEqual([{ text: 'a [ b' }])
  })
})

describe('the repo-root prose documents', () => {
  // Links are the only inline markdown the renderer interprets (see each file's
  // own header comment); anything else would ship as literal punctuation.
  test.each(DOCS)('$name uses no bold, italics, or bullets', ({ markdown }) => {
    const { paragraphs } = parseMarkdownSection(markdown)
    expect(paragraphs.length).toBeGreaterThan(0)
    for (const paragraph of paragraphs) {
      expect(paragraph).not.toMatch(/\*\*|^[-*]\s|^#/)
    }
  })

  test.each(DOCS)('$name links, if any, resolve to a real target', ({ markdown }) => {
    const links = parseMarkdownSection(markdown)
      .paragraphs.flatMap(parseInline)
      .filter((node) => node.href)
    for (const link of links) {
      expect(link.href).toMatch(/^https?:\/\/|^\//)
      expect(link.text.length).toBeGreaterThan(0)
    }
  })
})

describe('MarkdownSection', () => {
  test.each(DOCS)('renders the $name heading and every paragraph', ({ markdown }) => {
    const { heading, paragraphs } = parseMarkdownSection(markdown)
    render(<MarkdownSection markdown={markdown} />)

    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()

    // Compared against the rendered text, not the raw source: link syntax is
    // replaced by its label, so `[Jrvs](https://…)` reads as "Jrvs".
    const rendered = [...document.querySelectorAll('p')].map((p) => p.textContent)
    for (const paragraph of paragraphs) {
      const expected = parseInline(paragraph)
        .map((node) => node.text)
        .join('')
      expect(rendered).toContain(expected)
    }
  })

  test('renders a link as an anchor to its target', () => {
    render(<MarkdownSection markdown="visit [the site](https://alxjrvs.com) today" />)

    const link = screen.getByRole('link', { name: 'the site' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://alxjrvs.com')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('omits the heading element when the markdown has none', () => {
    render(<MarkdownSection markdown="body only" />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('body only')).toBeTruthy()
  })
})
