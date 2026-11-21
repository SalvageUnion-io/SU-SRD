/**
 * R10, ruleset §3.5.1 — the grain images land in two places only: the
 * header grain classes (`.su-grain--ink`, `.su-grain--paper`) and a Live
 * Sheet's paper panels (the masthead, the Ledgers' rows, the Scrap board),
 * scoped to the sheet's body. Paper anywhere else stays clean.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const STYLES = join(import.meta.dir, '..')

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : cssFiles(path)
    return name.endsWith('.css') ? [path] : []
  })
}

/** Every rule whose body names a grain image, as `file: selector`. */
function grainRules(): string[] {
  return cssFiles(STYLES).flatMap((file) => {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((rule) => /grain\/(?:ink|paper)\.svg/.test(rule[2] ?? ''))
      .map((rule) => `${relative(STYLES, file)}: ${(rule[1] ?? '').replace(/\s+/g, ' ').trim()}`)
  })
}

describe('R10: where the grain lands', () => {
  test('the header grain classes and a Live Sheet’s paper panels, nowhere else', () => {
    expect(grainRules().sort()).toEqual([
      'build/dash.css: .su-sheet-live-body :is(.su-mast, .su-open tbody > tr, .su-scrap)',
      'partials/card-chrome.css: .su-grain--ink',
      'partials/card-chrome.css: .su-grain--paper',
    ])
  })
})
