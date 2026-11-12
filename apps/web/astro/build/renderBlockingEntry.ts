/**
 * renderBlockingEntry — the page script, finished before the first paint.
 *
 * Every reference page loads one module (`astro/layouts/Page.astro`), and its
 * first act is to fit each on-screen head's chips beside its name
 * (`watchStaticChipFill`): what does not fit moves to the overflow row under
 * the band. Run after the first paint, that move was a layout shift, on a
 * listing's controls band most of all (CLS 0.45 on /systems/ at 1440px).
 *
 * So on a page whose band is a listing's controls band the build marks that
 * one module `blocking="render"`: the browser parses and lays out as before,
 * but paints only once the module has run, with the heads already fitted. A
 * browser without the attribute paints as it did. Only there: holding the
 * paint costs a round trip (a throttled Mule paints ~0.4 s later), and an
 * entity page's band moves a few pixels at most (CLS 0.005).
 * Render-blocking holds only for an element in `<head>`, which is where the
 * layout writes it. The module's own imports get a `modulepreload` beside it,
 * so they load with it rather than after it, and the wait stays one round trip.
 *
 * Astro leaves a `<script>` with any attribute but `src` unprocessed, so the
 * attribute cannot be written in the layout: this step adds it to the files.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The layout's processed script tag, by Astro's chunk name for it. */
const ENTRY_TAG =
  /<script type="module" src="(\/assets\/Page\.astro_astro_type_script_index_0_lang-[\w-]+\.js)"><\/script>/

/** A listing's controls band, which sends its view and filter controls out once fitted. */
const CONTROLS_BAND =
  /<div class="su-chapter-band"(?=[^>]*\bdata-chip-overflow-owner="")(?=[^>]*\bdata-aside="controls")/

/** Whether a page's first paint waits for its chips to be fitted. */
export function fitsBeforePaint(html: string): boolean {
  return CONTROLS_BAND.test(html)
}

/** The relative static imports of a built chunk (`import{…}from"./x.js"`, `import"./x.js"`). */
export function staticImports(chunk: string): string[] {
  const found = new Set<string>()
  for (const [, spec] of chunk.matchAll(
    /\bimport\s*(?:[\w${},\s*]+?\s*from\s*)?["'](\.\/[^"']+\.js)["']/g
  ))
    if (spec) found.add(spec)
  return [...found]
}

/** The entry's URL in a page's `<head>`, or undefined where the page has none there. */
export function entryOf(html: string): string | undefined {
  const head = html.slice(0, html.indexOf('</head>'))
  return head.match(ENTRY_TAG)?.[1]
}

/**
 * `html` with its head's entry script marked `blocking="render"`, its
 * `imports` (URLs) preloaded right before it. Unchanged where the head has
 * no entry, or the page no controls band (`fitsBeforePaint`).
 */
export function blockRenderOnEntry(html: string, imports: readonly string[]): string {
  const end = html.indexOf('</head>')
  if (end < 0 || !fitsBeforePaint(html)) return html
  const head = html.slice(0, end)
  const match = head.match(ENTRY_TAG)
  if (!match) return html
  const preloads = imports.map((href) => `<link rel="modulepreload" href="${href}">`).join('')
  const tag = `${preloads}<script type="module" blocking="render" src="${match[1]}"></script>`
  return head.replace(match[0], tag) + html.slice(end)
}

/** The entry's static imports as site URLs, read from the built chunk in `distDir`. */
export async function entryImports(distDir: string, entry: string): Promise<string[]> {
  const chunk = await readFile(join(distDir, entry), 'utf-8')
  const base = entry.slice(0, entry.lastIndexOf('/') + 1)
  return staticImports(chunk).map((spec) => base + spec.slice(2))
}
