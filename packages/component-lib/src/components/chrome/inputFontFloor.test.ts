import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The 16px floor on text-entry controls.
 *
 * **iOS Safari zooms the viewport whenever a focused form control renders below
 * 16px.** It is not configurable and not a preference: a 14px input means the
 * page lurches every time someone taps a field on an iPhone, which on the live
 * sheets is most of the app's interaction.
 *
 * This is easy to undo by accident, because a smaller rung usually looks better
 * next to a `text-caption` label — the field reads as "too big" beside its own
 * chrome, and the natural tidy-up is to drop it back to `text-sm`. That tidy-up
 * is a functional regression on one platform and invisible on every other, so
 * it gets a guard rather than a comment.
 *
 * Scope is deliberately the SHARED primitives in this package. App-level inputs
 * that build their own shell are checked by rendering the built output at 390px
 * instead — a static class-string check cannot follow inheritance, and the
 * failure this exists to catch (13px inherited from a wrapper) was found that
 * way, not by reading source.
 */

const PRIMITIVES = ['inputs.tsx', '../shared/SearchField.tsx', '../shared/EntitySearcher.tsx']

/** Tailwind rungs below 16px that must never land on a text-entry control. */
const TOO_SMALL = [
  'text-nano',
  'text-micro',
  'text-label',
  'text-badge',
  'text-note',
  'text-caption',
  'text-xs',
  'text-sm',
]

/**
 * Comments must go first, and both kinds matter — each produced a false
 * positive when this guard was written against the raw source:
 *
 *   - `SearchField.tsx`'s doc comment contains a literal `<input>`, which the
 *     element matcher happily treated as an element and then scanned 40 lines
 *     of prose for class names.
 *   - the note explaining *why* the rung is 16px names `text-caption` as the
 *     thing it replaced — so the guard flagged the comment that documents it.
 *
 * The second is the nastier shape: a guard that fails when you explain it
 * teaches people not to explain it.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/** The `className={...}` / `className="..."` string attached to an <input>/<textarea>. */
function inputClassStrings(source: string): string[] {
  const out: string[] = []
  for (const m of stripComments(source).matchAll(/<(input|textarea)\b([\s\S]*?)\/>/g)) {
    const body = m[2] ?? ''
    for (const c of body.matchAll(/className=\{?[\s\S]*?['"]([^'"]*)['"]/g)) {
      if (c[1]) out.push(c[1])
    }
  }
  return out
}

describe('text-entry controls hold a 16px floor', () => {
  test('the guard actually found the controls', () => {
    const total = PRIMITIVES.flatMap((f) =>
      inputClassStrings(readFileSync(join(import.meta.dir, f), 'utf8'))
    )
    // A renamed file or a reshaped element would otherwise pass vacuously.
    expect(total.length).toBeGreaterThanOrEqual(PRIMITIVES.length)
  })

  test('no shared input primitive carries a sub-16px rung', () => {
    const offenders: string[] = []
    for (const file of PRIMITIVES) {
      const source = readFileSync(join(import.meta.dir, file), 'utf8')
      for (const classes of inputClassStrings(source)) {
        for (const rung of TOO_SMALL) {
          // Whole-token match: `text-sm` must not match inside `text-smoke`.
          if (new RegExp(`(^|[\\s:])${rung}([\\s]|$)`).test(classes)) {
            offenders.push(`${file}: "${rung}" in "${classes.slice(0, 60)}…"`)
          }
        }
      }
    }
    expect(
      offenders,
      'a focused control below 16px makes iOS Safari zoom the page — use text-base'
    ).toEqual([])
  })
})
