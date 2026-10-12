/**
 * NO RAW MARKUP (entity display language E4, phase 3): every `[[Trait]]` the
 * rules text carries renders as a Mention — a word linked to its page with its
 * Peek — and never as the markup itself. So no page the site emits may carry
 * `[[` in its rendered body.
 *
 * Island props (`<script type="application/json">`) are data, not rendered
 * text: an island's entity travels raw and its client render draws the
 * Mentions, so script bodies are left out of the scan.
 */

import { describe, expect, it } from 'bun:test'
import { ELDRIDGE_COAST_MAP } from '../../src/lib/builtAssets'
import type { BuildAssets } from '../document'
import { routes } from '../routes'

const ASSETS: BuildAssets = {
  scripts: ['/assets/islands.js'],
  styles: ['/assets/styles.css'],
  built: { [ELDRIDGE_COAST_MAP]: '/assets/eldridge-coast-map.webp' },
}

/** The rendered body: everything after `<body`, without its script blocks. */
function renderedBody(html: string): string {
  return html.slice(html.indexOf('<body')).replace(/<script\b[\s\S]*?<\/script>/g, '')
}

describe('rendered pages', () => {
  it('carry no raw [[markup]] in any page body', () => {
    const offenders: string[] = []
    let pages = 0
    for (const route of routes) {
      for (const page of route.resolve()) {
        pages++
        const body = renderedBody(page.render(ASSETS))
        const at = body.indexOf('[[')
        if (at >= 0) offenders.push(`${page.route}: …${body.slice(Math.max(0, at - 60), at + 40)}…`)
      }
    }
    // A scan that rendered nothing would pass vacuously.
    expect(pages).toBeGreaterThan(900)
    expect(offenders).toEqual([])
  }, 300_000)

  it('draws a rules-text trait as a Mention linked to its page, with its Peek', () => {
    const page = routes
      .flatMap((route) => route.resolve())
      .find((p) => p.route === '/schema/roll-tables/item/mechapult')
    const body = renderedBody(page?.render(ASSETS) ?? '')
    expect(body).toMatch(
      /<a href="\/schema\/traits\/item\/burn\/" class="su-inline-ref su-inline-ref--link" data-peek="traits:[^"]+">Burn \(X\)<\/a>/
    )
  })
})
