import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MarkdownSection } from './MarkdownSection'
import { parseInline, parseMarkdownSection } from './parseMarkdownSection'

/** The repo-root prose documents both about pages render. */
const DOCS = ['ABOUT_JRVS.md', 'LLM_STATEMENT.md', 'SPECIAL_THANKS.md'].map((name) => ({
  name,
  markdown: readFileSync(join(import.meta.dir, '../../../..', name), 'utf8'),
}))

/** The prose of a block, for assertions that don't care about list vs paragraph. */
const textsOf = (content: ReturnType<typeof parseMarkdownSection>): string[] =>
  content.blocks.flatMap((block) => (block.kind === 'list' ? block.items : [block.text]))

describe('parseMarkdownSection', () => {
  test('drops the HTML comment header and reads each heading', () => {
    const headings = DOCS.map((doc) => parseMarkdownSection(doc.markdown).heading)
    expect(headings).toEqual(['About the Dev', 'LLM Statement', 'Special Thanks'])
  })

  test('joins soft-wrapped prose into one paragraph per block', () => {
    const { blocks } = parseMarkdownSection('# Head\n\nfirst line\nsecond line\n\nnext block\n')
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'first line second line' },
      { kind: 'paragraph', text: 'next block' },
    ])
  })

  test('tolerates a file with no heading', () => {
    expect(parseMarkdownSection('just prose')).toEqual({
      heading: '',
      blocks: [{ kind: 'paragraph', text: 'just prose' }],
    })
  })

  test('drops a multi-line comment block even when blank lines split it', () => {
    const { heading, blocks } = parseMarkdownSection(
      '<!--\n  note\n\n  more note\n-->\n\n# Head\n\nbody\n'
    )
    expect(heading).toBe('Head')
    expect(blocks).toEqual([{ kind: 'paragraph', text: 'body' }])
  })

  test('never partially removes a comment span, so nothing can be spliced', () => {
    // A single `<!--[\s\S]*?-->` replace turns this into a fresh `<!--`, by
    // cutting the inner span out and joining the text either side of it. Whole
    // lines are kept or dropped here, so the line survives verbatim and is
    // rendered as literal text.
    const line = '<!<!-- comment -->-- still here'
    expect(parseMarkdownSection(line).blocks).toEqual([{ kind: 'paragraph', text: line }])
  })
})

describe('parseMarkdownSection — bullet lists', () => {
  test('an all-item block becomes one list, in order', () => {
    const { blocks } = parseMarkdownSection('# Head\n\nlead in\n\n- one\n- two\n- three\n')
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'lead in' },
      { kind: 'list', items: ['one', 'two', 'three'] },
    ])
  })

  test('a block mixing prose and dashes stays a paragraph', () => {
    // All-or-nothing keeps the change additive: a document written before lists
    // existed parses to exactly the blocks it always did.
    const { blocks } = parseMarkdownSection('lead in\n- one\n- two\n')
    expect(blocks).toEqual([{ kind: 'paragraph', text: 'lead in - one - two' }])
  })

  test('a bare dash with no text is not an item', () => {
    expect(parseMarkdownSection('-\n').blocks).toEqual([{ kind: 'paragraph', text: '-' }])
  })

  test('a list item may carry a link', () => {
    const { blocks } = parseMarkdownSection('- see [the site](https://alxjrvs.com)\n')
    expect(blocks).toEqual([{ kind: 'list', items: ['see [the site](https://alxjrvs.com)'] }])
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
  // Links and `- ` lists are all the renderer interprets (see each file's own
  // header comment); bold and italics would ship as literal punctuation. A
  // bullet that survives into block text means the list didn't parse — the
  // failure this guards is a missing blank line before a list.
  test.each(DOCS)('$name uses no bold or italics, and no stray bullets', ({ markdown }) => {
    const texts = textsOf(parseMarkdownSection(markdown))
    expect(texts.length).toBeGreaterThan(0)
    for (const text of texts) {
      expect(text).not.toMatch(/\*\*|^[-*]\s|^#/)
    }
  })

  test.each(DOCS)('$name links, if any, resolve to a real target', ({ markdown }) => {
    const links = textsOf(parseMarkdownSection(markdown))
      .flatMap(parseInline)
      .filter((node) => node.href)
    for (const link of links) {
      expect(link.href).toMatch(/^https?:\/\/|^\//)
      expect(link.text.length).toBeGreaterThan(0)
    }
  })
})

describe('MarkdownSection', () => {
  test.each(DOCS)('renders the $name heading and every block', ({ markdown }) => {
    const content = parseMarkdownSection(markdown)
    render(<MarkdownSection markdown={markdown} />)

    expect(screen.getByRole('heading', { name: content.heading })).toBeTruthy()

    // Compared against the rendered text, not the raw source: link syntax is
    // replaced by its label, so `[Jrvs](https://…)` reads as "Jrvs".
    const rendered = [...document.querySelectorAll('p, li')].map((el) => el.textContent)
    for (const text of textsOf(content)) {
      const expected = parseInline(text)
        .map((node) => node.text)
        .join('')
      expect(rendered).toContain(expected)
    }
  })

  test('renders a bullet block as a list, one item per entry', () => {
    render(<MarkdownSection markdown={'# Head\n\n- Tommy_Dude\n- lunarsignals\n'} />)

    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['Tommy_Dude', 'lunarsignals'])
    expect(screen.getAllByRole('list')).toHaveLength(1)
  })

  test('the real SPECIAL_THANKS.md renders its crew as a list, not literal dashes', () => {
    const markdown = DOCS.find((doc) => doc.name === 'SPECIAL_THANKS.md')?.markdown ?? ''
    render(<MarkdownSection markdown={markdown} />)

    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toContain('Tommy_Dude')
    expect(items).toContain('Saving Throw')
    // The failure this catches: a list that didn't parse renders as one
    // paragraph reading "- Tommy_Dude - lunarsignals - …".
    for (const p of document.querySelectorAll('p')) {
      expect(p.textContent ?? '').not.toContain('- ')
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
