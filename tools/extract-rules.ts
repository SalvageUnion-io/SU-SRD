/**
 * Rules PDF text-extraction tool.
 *
 * Extracts the plain-text layer from every Salvage Union rules PDF in `rules/`
 * to `rules/extracted/<name>.txt`, inserting `<!-- page N -->` markers at page
 * boundaries so the curated digest in `docs/rules/` can cite exact pages.
 *
 * The PDFs and this extract are gitignored (`rules/*`) — they are copyright-
 * bearing verbatim material and must never be committed. This extract is a
 * local, regenerable substrate: a greppable full-text fallback and the source
 * material from which the curated digest is authored.
 *
 * Requires `pdftotext` (poppler) on PATH.
 *
 * Run directly:  bun tools/extract-rules.ts [rulesDir=rules]
 * Or import:     import { extractAll } from './extract-rules'
 */
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'

export async function extractPdf(pdfPath: string): Promise<string> {
  // No -layout: poppler's reading-order heuristic keeps two-column prose more
  // coherent than fixed-position layout mode for this book. `\f` (form feed)
  // separates pages.
  const proc = Bun.spawn(['pdftotext', '-enc', 'UTF-8', pdfPath, '-'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
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

/** Extract every PDF in `rulesDir` to `rulesDir/extracted/<name>.txt`. */
export async function extractAll(rulesDir = 'rules'): Promise<string[]> {
  const outDir = join(rulesDir, 'extracted')
  const pdfs = readdirSync(rulesDir).filter((f) => f.toLowerCase().endsWith('.pdf'))
  if (pdfs.length === 0) {
    throw new Error(`No PDFs found in ${rulesDir}/`)
  }
  mkdirSync(outDir, { recursive: true })

  const written: string[] = []
  for (const pdf of pdfs) {
    const src = join(rulesDir, pdf)
    const dest = join(outDir, `${basename(pdf, '.pdf')}.txt`)
    process.stdout.write(`Extracting ${pdf} … `)
    const raw = await extractPdf(src)
    writeFileSync(dest, withPageMarkers(raw))
    console.log(`${raw.split('\f').length} pages → ${dest}`)
    written.push(dest)
  }
  return written
}

if (import.meta.main) {
  await extractAll(process.argv[2] ?? 'rules')
}
