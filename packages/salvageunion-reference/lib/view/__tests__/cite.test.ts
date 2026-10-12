import { describe, expect, test } from 'bun:test'
import { formatCite, formatProvenance } from '../parts/cite'

describe('formatCite', () => {
  test('prints the core book by its title-page name', () => {
    expect(formatCite({ source: 'Salvage Union Workshop Manual', page: 234 })).toBe(
      'Workshop Manual · p.234'
    )
  })

  test('resolves the "Core Book" alias to the same name, never printing it', () => {
    expect(formatCite({ source: 'Core Book', page: 18 })).toBe('Workshop Manual · p.18')
    expect(formatCite({ source: 'core book', page: 18 })).toBe('Workshop Manual · p.18')
  })

  test('prints any other book as its source', () => {
    expect(formatCite({ source: 'Reclamation of the Wastes', page: 103 })).toBe(
      'Reclamation of the Wastes · p.103'
    )
  })

  test('a span prints as pp., and each see entry follows the page', () => {
    expect(formatCite({ source: 'Salvage Union Workshop Manual', page: [18, 19] })).toBe(
      'Workshop Manual · pp.18–19'
    )
    expect(
      formatCite({
        source: 'Salvage Union Workshop Manual',
        page: 212,
        see: [{ label: 'Crawler types', page: [216, 217] }],
      })
    ).toBe('Workshop Manual · p.212 · Crawler types pp.216–217')
  })
})

describe('formatProvenance', () => {
  test("an entity's cite names the core book as a hand-written one does", () => {
    expect(formatProvenance('Salvage Union Workshop Manual', undefined, 104)).toBe(
      formatCite({ source: 'Salvage Union Workshop Manual', page: 104 })
    )
  })

  test('any other book keeps its source and booklet', () => {
    expect(formatProvenance('Salvage Union Starter Set', 'PC', 26)).toBe(
      'Salvage Union Starter Set (PC) · p.26'
    )
  })
})
