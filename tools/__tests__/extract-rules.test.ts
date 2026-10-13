import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractAll, findExtractDir, LAYER_DIR, withPageMarkers } from '../extract-rules'

/**
 * `tools/extract-rules.ts` — where the extract is found, and the page markers
 * it writes. Running `pdftotext` on the real books is `bun run rules:extract`.
 */

const temps: string[] = []
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'extract-rules-'))
  temps.push(dir)
  return dir
}

describe('findExtractDir', () => {
  /** Runs `findExtractDir` with `RULES_EXTRACT_DIR` set to `value`. */
  function withEnv(value: string): string | undefined {
    const saved = process.env.RULES_EXTRACT_DIR
    process.env.RULES_EXTRACT_DIR = value
    try {
      return findExtractDir()
    } finally {
      if (saved === undefined) delete process.env.RULES_EXTRACT_DIR
      else process.env.RULES_EXTRACT_DIR = saved
    }
  }

  test('RULES_EXTRACT_DIR wins when it exists', () => {
    const dir = tempDir()
    expect(withEnv(dir)).toBe(dir)
  })

  test('a RULES_EXTRACT_DIR that does not exist falls through to the other places', () => {
    const missing = join(tempDir(), 'nowhere')
    expect(withEnv(missing)).not.toBe(missing)
  })
})

describe('withPageMarkers', () => {
  test('numbers each form-feed page from 1 and trims its trailing space', () => {
    expect(withPageMarkers('Cover  \n\fChapter 1\n\n\fIndex')).toBe(
      '<!-- page 1 -->\nCover\n\n<!-- page 2 -->\nChapter 1\n\n<!-- page 3 -->\nIndex'
    )
  })

  test('a text with no form feed is one page', () => {
    expect(withPageMarkers('only')).toBe('<!-- page 1 -->\nonly')
  })
})

test('the raw layer is written beside the flow layer, one subdirectory down', () => {
  expect(LAYER_DIR).toEqual({ flow: '.', raw: 'raw' })
})

describe('extractAll', () => {
  test('refuses a rules directory with no PDFs', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'notes.txt'), 'not a book')
    await expect(extractAll(dir)).rejects.toThrow(`No PDFs found in ${dir}/`)
  })

  test('a PDF pdftotext cannot read fails the extraction', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'Broken.PDF'), 'not a pdf')
    const out = spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      // With poppler installed, pdftotext exits non-zero; without it, the spawn fails.
      await expect(extractAll(dir)).rejects.toThrow()
      expect(String(out.mock.calls[0]?.[0])).toBe('Extracting Broken.PDF (flow) … ')
    } finally {
      out.mockRestore()
    }
    // The layer's directory is made before the extraction is tried.
    mkdirSync(join(dir, 'extracted'), { recursive: true })
  })
})
