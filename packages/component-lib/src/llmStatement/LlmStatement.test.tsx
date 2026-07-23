import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { LlmStatement } from './LlmStatement'
import { parseLlmStatement } from './parseLlmStatement'

afterEach(cleanup)

/** The single source of truth both about pages render. */
const STATEMENT_MD = readFileSync(join(import.meta.dir, '../../../../LLM_STATEMENT.md'), 'utf8')

describe('parseLlmStatement', () => {
  test('drops the HTML comment header and reads the heading', () => {
    const { heading } = parseLlmStatement(STATEMENT_MD)
    expect(heading).toBe('How this was built')
  })

  test('joins soft-wrapped prose into one paragraph per block', () => {
    const { paragraphs } = parseLlmStatement('# Head\n\nfirst line\nsecond line\n\nnext block\n')
    expect(paragraphs).toEqual(['first line second line', 'next block'])
  })

  test('tolerates a file with no heading', () => {
    expect(parseLlmStatement('just prose')).toEqual({ heading: '', paragraphs: ['just prose'] })
  })
})

describe('LLM_STATEMENT.md', () => {
  // The renderer does not interpret inline markdown (see the file's own header
  // comment), so syntax added there would ship as literal punctuation.
  test('is plain paragraphs — no links, bold, or bullets to render literally', () => {
    const { paragraphs } = parseLlmStatement(STATEMENT_MD)
    expect(paragraphs.length).toBeGreaterThan(0)
    for (const paragraph of paragraphs) {
      expect(paragraph).not.toMatch(/\[[^\]]*]\(|\*\*|^[-*]\s|^#/)
    }
  })
})

describe('LlmStatement', () => {
  test('renders the real statement heading and every paragraph', () => {
    const { heading, paragraphs } = parseLlmStatement(STATEMENT_MD)
    render(<LlmStatement markdown={STATEMENT_MD} />)

    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    for (const paragraph of paragraphs) {
      expect(screen.getByText(paragraph)).toBeTruthy()
    }
  })

  test('omits the heading element when the markdown has none', () => {
    render(<LlmStatement markdown="body only" />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('body only')).toBeTruthy()
  })
})
