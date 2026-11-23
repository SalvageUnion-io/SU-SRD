import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A phone's 44px targets on a sheet line (hard rule R12, r2 H1): the remove
 * and a use's steps draw at their chip's height, as on every pointer, and on
 * a phone each takes a 44px hit area; the remove stands apart from the line's
 * toggles by more than its target reaches back, so the two never overlap.
 */
const css = readFileSync(join(import.meta.dir, '../build/sheet/items.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
)
const phone = css.match(/@media not \(width >= 40rem\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
const rule = (selector: string) =>
  phone.match(
    new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`)
  )?.[1] ?? ''
const px = (name: string) => Number(name.match(/--space-(\d+)/)?.[1])

describe('a sheet line’s targets on a phone', () => {
  test('the remove’s hit area is 44px, block and inline', () => {
    const after = rule('.su-sheet-item__remove::after')
    expect(after).toContain('inset-block: min(0px, calc(50% - var(--size-full) / 2))')
    expect(after).toContain('inset-inline: calc(var(--size-mini) - var(--size-full)) 0')
  })

  test('the remove stands further from the toggles than its target reaches back', () => {
    // The target reaches 44 − 18 = 26px back from the 18px square.
    const gap = px(rule('.su-sheet-item__remove'))
    expect(gap).toBeGreaterThan(44 - 18)
  })

  test('a use’s steps take 44px targets of their own', () => {
    const step = '.su-stat-stepper:has(> .su-sheet-item__uses) .su-step-btn--cell'
    expect(rule(step)).toContain('min-width: var(--space-40)')
    expect(rule(`${step}::after`)).toContain('var(--size-full)')
  })
})

/**
 * A list's count on a phone (R12, r3 I4): its steps draw at a fingertip's
 * size, 40px square in the 44px row, not only reach it with a hidden area.
 */
describe('a list count’s steps on a phone', () => {
  const ledger = readFileSync(join(import.meta.dir, '../partials/ledger.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  )
  // Two rules: the pointer's 24px floor (r4 E22), then the phone's, which this reads.
  const steps = [
    ...ledger.matchAll(
      /\.su-ledger__table tbody \[data-kind='trailing'\] \.su-step-btn--cell\s*\{([^}]*)\}/g
    ),
  ].map((found) => found[1] ?? '')
  const step = steps[1] ?? ''

  test('draw 24px square at the least off the phone', () => {
    expect(steps[0]).toContain('min-height: var(--space-24)')
  })

  test('draw 40px square', () => {
    expect(step).toContain('min-height: var(--space-40)')
    expect(step).toContain('min-width: var(--space-40)')
  })

  test('and still reach the 44px target', () => {
    expect(ledger).toContain(
      ".su-ledger__table tbody [data-kind='trailing'] .su-step-btn--cell::after"
    )
    expect(ledger).toContain('inset-block: min(0px, calc(50% - var(--size-full) / 2))')
  })
})

/** r8 C3 (MD8-11): a list row's ⋯ on a phone is 44px wide, its hit area the 44px row. */
describe('a list row’s ⋯ on a phone', () => {
  const ledger = readFileSync(join(import.meta.dir, '../partials/ledger.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  )
  const phone = ledger.slice(ledger.indexOf('@media not (width >= 40rem) {'))
  const trigger =
    '.su-ledger__table tbody .su-ledger__trailing-line > .su-header-menu-trigger--overflow'
  const body = (selector: string) => phone.slice(phone.indexOf(`${selector} {`)).split('}')[0] ?? ''

  test('draws 44px wide, and its row is 44px tall', () => {
    expect(body(trigger)).toContain('min-inline-size: var(--size-full)')
    expect(body('.su-ledger__table tbody tr:has(.su-header-menu-trigger--overflow) > *')).toContain(
      'height: var(--size-full)'
    )
  })

  test('and its hit area reaches the row’s 44px', () => {
    expect(body(`${trigger}::after`)).toContain(
      'inset-block: min(0px, calc(50% - var(--size-full) / 2))'
    )
  })
})
