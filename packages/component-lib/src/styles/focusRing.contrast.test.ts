import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { color } from '../design/tokens'

/**
 * Focus-ring contrast guard.
 *
 * The ring shipped for months as `rust/25` — a 25%-alpha wash that composited
 * to 1.42:1 against paper and 1.27:1 against `ink-deep`, where WCAG 2.4.11 and
 * 1.4.11 both require 3:1. Every existing check was green throughout: it
 * typechecks, it lints, `check:tokens` passes (an alpha rung is a legal token),
 * and the parity guard only asks whether the two halves of the scale agree —
 * not whether the value they agree on can be seen.
 *
 * So this asserts the property none of those do: that the ring a keyboard user
 * actually gets clears 3:1 against every ground the app puts behind it.
 *
 * ## Why it reads CSS rather than rendering
 *
 * `:focus-visible` does not match programmatic focus, so `el.focus()` plus
 * `getComputedStyle` reports `boxShadow: none` on a ring that is perfectly
 * fine — see "Checking a focus style: `.focus()` will lie to you" in this
 * package's CLAUDE.md. A render-based assertion here would fail for a reason
 * unrelated to contrast, and the natural fix for that failure is to weaken the
 * assertion. Parsing the declaration sidesteps the trap entirely.
 */

const CSS_PATH = join(import.meta.dir, 'index.css')
const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** WCAG 2.1 relative luminance for an `rgb(r, g, b)` triple. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

/** `rgb(168, 82, 34)` / `rgb(168 82 34 / 0.25)` → a triple. Alpha is rejected, not ignored. */
function parseRgb(value: string): [number, number, number] {
  const m = value.match(/rgb\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(\/\s*[\d.]+)?\s*\)/)
  if (!m) throw new Error(`not an rgb() value: ${value}`)
  if (m[4]) throw new Error(`focus colours must be opaque, got alpha in: ${value}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/**
 * Grounds the focus ring is laid on somewhere in the two apps. `ink` is the one
 * that matters most: solid rust measures 2.97:1 against it, so a single-ring
 * "just make it solid" fix passes on paper and fails here.
 */
const GROUNDS = {
  paper: parseRgb(color.paper),
  wkBg: parseRgb(color.wkBg),
  ink: parseRgb(color.ink),
  inkDeep: parseRgb(color.inkDeep),
} as const

/** The two rings `--focus-ring-shadow` is built from, innermost first. */
function ringLayers(): { offset: [number, number, number]; ring: [number, number, number] } {
  const decl = css.match(/--focus-ring-shadow:\s*([^;]+);/)
  if (!decl?.[1]) throw new Error('--focus-ring-shadow is not declared in index.css')
  const vars = [...decl[1].matchAll(/var\(--su-color-([a-z0-9-]+)\)/g)].map((m) => m[1])
  if (vars.length !== 2) {
    throw new Error(`expected a two-ring shadow built from two colour tokens, got: ${decl[1]}`)
  }
  const lookup = (kebab: string): [number, number, number] => {
    const camel = kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
    const value = (color as Record<string, string>)[camel]
    if (!value) throw new Error(`--su-color-${kebab} has no token`)
    return parseRgb(value)
  }
  return { offset: lookup(vars[0] ?? ''), ring: lookup(vars[1] ?? '') }
}

/** Every rule in the stylesheet whose selector is a focus state. */
function focusRules(): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = []
  for (const m of css.matchAll(/([^{}]*:focus(?:-visible|-within)?[^{}]*)\{([^}]*)\}/g)) {
    const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ')
    if (selector.startsWith('@')) continue
    out.push({ selector, body: m[2] ?? '' })
  }
  return out
}

describe('focus ring contrast', () => {
  test('the guard actually parsed the stylesheet', () => {
    // A reshaped file would otherwise make every assertion below pass vacuously.
    expect(focusRules().length).toBeGreaterThan(4)
  })

  test('the ring is opaque — no alpha wash may be a focus indicator', () => {
    // parseRgb throws on alpha, so simply resolving the layers is the assertion.
    expect(() => ringLayers()).not.toThrow()
  })

  test('at least one ring layer clears 3:1 against every ground', () => {
    const { offset, ring } = ringLayers()
    const failures: string[] = []
    for (const [name, ground] of Object.entries(GROUNDS)) {
      const best = Math.max(contrast(ring, ground), contrast(offset, ground))
      if (best < 3) {
        failures.push(`${name}: best layer is ${best.toFixed(2)}:1, needs 3:1`)
      }
    }
    expect(failures, 'the focus ring is invisible on a ground the app actually uses').toEqual([])
  })

  test('the two ring layers are distinguishable from each other', () => {
    // A two-ring construction whose layers match is one ring wearing a disguise:
    // it would pass the per-ground check above while showing a single band.
    const { offset, ring } = ringLayers()
    expect(contrast(offset, ring)).toBeGreaterThanOrEqual(3)
  })

  test('no focus rule suppresses the outline without leaving one for forced-colors', () => {
    // Windows High Contrast Mode does not paint box-shadow. `outline: none` plus
    // a box-shadow ring means focus is absent there, not merely faint.
    const offenders = focusRules()
      .filter(({ body }) => /outline:\s*none/.test(body))
      .map(({ selector }) => selector)
    expect(
      offenders,
      'use `outline: 3px solid transparent` so forced-colors has something to paint'
    ).toEqual([])
  })
})
