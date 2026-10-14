import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  test('writes the flow and the -raw layer of every PDF, each with page markers', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'Core.pdf'), '%PDF stub')
    const argv: string[][] = []
    // pdftotext is stubbed: the books are not in the repo, and poppler may not be installed.
    const spawn = spyOn(Bun, 'spawn').mockImplementation(((cmd: string[]) => {
      argv.push(cmd)
      const layer = cmd.includes('-raw') ? 'raw' : 'flow'
      return {
        stdout: new Response(`${layer} one  \f${layer} two\n`).body,
        stderr: new Response('').body,
        exited: Promise.resolve(0),
      }
    }) as unknown as typeof Bun.spawn)
    const out = spyOn(process.stdout, 'write').mockImplementation(() => true)
    const log = spyOn(console, 'log').mockImplementation(() => {})
    try {
      const written = await extractAll(dir)
      expect(written).toEqual([
        join(dir, 'extracted', 'Core.txt'),
        join(dir, 'extracted', 'raw', 'Core.txt'),
      ])
      expect(readFileSync(join(dir, 'extracted', 'raw', 'Core.txt'), 'utf8')).toBe(
        '<!-- page 1 -->\nraw one\n\n<!-- page 2 -->\nraw two'
      )
      expect(argv).toEqual([
        ['pdftotext', '-enc', 'UTF-8', join(dir, 'Core.pdf'), '-'],
        ['pdftotext', '-enc', 'UTF-8', '-raw', join(dir, 'Core.pdf'), '-'],
      ])
      expect(log.mock.calls[0]?.[0]).toBe(`2 pages → ${join(dir, 'extracted', 'Core.txt')}`)
    } finally {
      spawn.mockRestore()
      out.mockRestore()
      log.mockRestore()
    }
  })

  test('a non-zero pdftotext exit names the file, the code and its stderr', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'Bad.pdf'), 'x')
    const spawn = spyOn(Bun, 'spawn').mockImplementation((() => ({
      stdout: new Response('').body,
      stderr: new Response('Syntax Error').body,
      exited: Promise.resolve(3),
    })) as unknown as typeof Bun.spawn)
    const out = spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      await expect(extractAll(dir)).rejects.toThrow(
        `pdftotext failed for ${join(dir, 'Bad.pdf')} (exit 3): Syntax Error`
      )
    } finally {
      spawn.mockRestore()
      out.mockRestore()
    }
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
