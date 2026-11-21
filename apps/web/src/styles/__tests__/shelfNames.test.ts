import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * R56 on the Training Bay: a shelf's word cells (its Game, its mech, its
 * class) wrap, never cut to "…", at every width. This reads the stylesheet's
 * every rule on them (`ledger.css`).
 */
const css = readFileSync(join(import.meta.dir, '..', 'partials', 'ledger.css'), 'utf8')

/** The declarations of every rule whose selector is exactly the given text. */
function rules(selector: string): string[] {
  const out: string[] = []
  for (
    let at = css.indexOf(`${selector} {`);
    at !== -1;
    at = css.indexOf(`${selector} {`, at + 1)
  ) {
    out.push(css.slice(at, css.indexOf('}', at)))
  }
  return out
}

describe("a shelf's word cells are never cut (R56)", () => {
  const cell = ".su-shelf-ledger .su-ledger__table td[data-kind='text']"

  test('every rule on them wraps and none cuts', () => {
    const found = rules(cell)
    expect(found.length).toBeGreaterThan(0)
    for (const rule of found) {
      expect(rule).not.toContain('text-overflow')
      expect(rule).not.toContain('nowrap')
      expect(rule).toContain('white-space: normal')
    }
  })
})
