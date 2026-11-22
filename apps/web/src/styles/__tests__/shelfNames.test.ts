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

/**
 * A shelf of many figures (Mechs) keeps its make and each line's menu inside
 * the frame: it answers to its own width, and under it spares the columns
 * marked for it (the Mechs shelf's live readings).
 */
describe('a shelf never runs wider than its frame', () => {
  test('a shelf is a size container, and a narrow one drops its spare columns', () => {
    expect(
      rules('.su-shelf-ledger').some((rule) => rule.includes('container-type: inline-size'))
    ).toBe(true)
    const narrow = css.slice(css.indexOf('@container not (width >= 48rem)'))
    expect(narrow.slice(0, narrow.indexOf('}'))).toContain('[data-spare]')
    expect(narrow.slice(0, narrow.indexOf('}'))).toContain('display: none')
  })
})

/** r4 E1: a shelf's rule-breaking mark wraps under the name; it never sets the list's width. */
describe('a rule-breaking mark under a name', () => {
  test('stacks and wraps by the word', () => {
    expect(rules('.su-ledger__under [data-rule-break] > .su-stat-cell--wrap').join()).toContain(
      'flex-wrap: wrap'
    )
    const words = rules('.su-ledger__under [data-rule-break] .su-stat-plate--wrap').join()
    expect(words).toContain('overflow-wrap: break-word')
    expect(words).not.toContain('nowrap')
  })
})

/** SB-17: on a phone a count's − and + each take a 44px target, inside the frame. */
describe("a count's steps on a phone", () => {
  const step = ".su-ledger__table tbody [data-kind='trailing'] .su-step-btn--cell"

  test('each draws 40px wide and reaches 44px over what is not a control', () => {
    expect(rules(step).join()).toContain('min-width: var(--space-40)')
    expect(rules(`${step}:first-of-type::after`).join()).toContain(
      'inset-inline-start: calc(var(--space-40) - var(--size-full))'
    )
    expect(rules(`${step}:last-of-type::after`).join()).toContain(
      'inset-inline-end: calc(var(--space-40) - var(--size-full))'
    )
  })
})
