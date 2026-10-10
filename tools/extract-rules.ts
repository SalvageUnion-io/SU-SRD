/**
 * Rules PDF text-extraction tool.
 *
 * Extracts the plain-text layer from every Salvage Union rules PDF in `rules/`
 * to `rules/extracted/<name>.txt`, inserting `<!-- page N -->` markers at page
 * boundaries so a reader can cite exact pages.
 *
 * It also writes a second layer, `rules/extracted/raw/<name>.txt`, in the
 * PDF's content-stream order (`pdftotext -raw`). Poppler's default reading
 * order interleaves the book's two-column pages, sidebars and stat lines
 * mid-sentence; content-stream order follows each text frame as the designer
 * set it, so a paragraph comes out whole. `check-rules-fidelity.ts` searches
 * both. Measured against the 2.0a books: of the 130 strings the default layer
 * could only match as "extraction artefacts", 125 match the raw layer outright,
 * where `-layout` with its columns split apart matched 4. The raw layer lives
 * in a subdirectory so the `*.txt` that `check-printed-names.ts` and readers
 * grep stay one file per book.
 *
 * The PDFs and this extract are gitignored (`rules/*`) — they are copyright-
 * bearing verbatim material and must never be committed. This extract is a
 * local, regenerable substrate: a greppable full-text fallback for "what does
 * the book actually say".
 *
 * Requires `pdftotext` (poppler) on PATH.
 *
 * Run directly:  bun tools/extract-rules.ts [rulesDir=rules]
 * Or import:     import { extractAll } from './extract-rules'
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

/** `flow`: poppler's reading order. `raw`: content-stream order (`-raw`). */
export type Layer = 'flow' | 'raw'

/** The subdirectory of `rules/extracted/` each layer is written to. */
export const LAYER_DIR: Record<Layer, string> = { flow: '.', raw: 'raw' }

export async function extractPdf(pdfPath: string, layer: Layer = 'flow'): Promise<string> {
  // No -layout for `flow`: poppler's reading-order heuristic keeps two-column
  // prose more coherent than fixed-position layout mode for this book. `\f`
  // (form feed) separates pages.
  const proc = Bun.spawn(
    ['pdftotext', '-enc', 'UTF-8', ...(layer === 'raw' ? ['-raw'] : []), pdfPath, '-'],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0) {
    throw new Error(`pdftotext failed for ${pdfPath} (exit ${code}): ${err}`)
  }
  return out
}

export function withPageMarkers(text: string): string {
  return text
    .split('\f')
    .map((page, i) => `<!-- page ${i + 1} -->\n${page.trimEnd()}`)
    .join('\n\n')
}

/** Extract every PDF in `rulesDir` to `rulesDir/extracted/[raw/]<name>.txt`. */
export async function extractAll(rulesDir = 'rules'): Promise<string[]> {
  const outDir = join(rulesDir, 'extracted')
  const pdfs = readdirSync(rulesDir).filter((f) => f.toLowerCase().endsWith('.pdf'))
  if (pdfs.length === 0) {
    throw new Error(`No PDFs found in ${rulesDir}/`)
  }

  const written: string[] = []
  for (const pdf of pdfs) {
    const src = join(rulesDir, pdf)
    for (const layer of ['flow', 'raw'] as const) {
      const dir = join(outDir, LAYER_DIR[layer])
      mkdirSync(dir, { recursive: true })
      const dest = join(dir, `${basename(pdf, '.pdf')}.txt`)
      process.stdout.write(`Extracting ${pdf} (${layer}) … `)
      const raw = await extractPdf(src, layer)
      writeFileSync(dest, withPageMarkers(raw))
      console.log(`${raw.split('\f').length} pages → ${dest}`)
      written.push(dest)
    }
  }
  return written
}

if (import.meta.main) {
  await extractAll(process.argv[2] ?? 'rules')
}
