import { describe, test, expect } from 'bun:test'
import { buildNameRegistry, highlightEntityNames } from '../logHighlighting'
import type { NameRegistry } from '../logHighlighting'

// ---------------------------------------------------------------------------
// buildNameRegistry
// ---------------------------------------------------------------------------

describe('buildNameRegistry', () => {
  test('builds registry from all sources', () => {
    const registry = buildNameRegistry({
      crawlerName: 'Atlas',
      pilotCallsigns: ['Bolt', 'Sparks'],
      mechPatternNames: ['Iron Mongrel'],
    })

    expect(registry).toHaveLength(4)
    expect(registry[0]!.name).toBe('Iron Mongrel') // longest first
  })

  test('sorts longest name first to prevent partial matches', () => {
    const registry = buildNameRegistry({
      pilotCallsigns: ['Bo', 'Bolt Lightning'],
      mechPatternNames: ['Bolt'],
    })

    expect(registry[0]!.name).toBe('Bolt Lightning')
    expect(registry[1]!.name).toBe('Bolt')
    expect(registry[2]!.name).toBe('Bo')
  })

  test('skips null/empty values', () => {
    const registry = buildNameRegistry({
      crawlerName: null,
      pilotCallsigns: ['', 'Bolt'],
      mechPatternNames: [],
    })

    expect(registry).toHaveLength(1)
    expect(registry[0]!.name).toBe('Bolt')
  })

  test('returns empty registry when no names provided', () => {
    const registry = buildNameRegistry({})
    expect(registry).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// highlightEntityNames
// ---------------------------------------------------------------------------

describe('highlightEntityNames', () => {
  const registry: NameRegistry = [
    { name: 'Iron Mongrel', color: 'mech' },
    { name: 'Atlas', color: 'crawler' },
    { name: 'Bolt', color: 'pilot' },
  ]

  test('returns plain text when no matches', () => {
    const result = highlightEntityNames('Nothing here', registry)
    expect(result).toEqual(['Nothing here'])
  })

  test('highlights a single name', () => {
    const result = highlightEntityNames('Bolt HP 6 → 4', registry)
    expect(result).toHaveLength(2)
    // First element is a React element (span)
    expect(typeof result[0]).toBe('object')
    // Second element is text
    expect(result[1]).toBe(' HP 6 → 4')
  })

  test('highlights multiple different entity types', () => {
    const result = highlightEntityNames('Bolt boarded Iron Mongrel on Atlas', registry)
    // Should have: "Bolt" (pilot), " boarded " (text), "Iron Mongrel" (mech), " on " (text), "Atlas" (crawler)
    expect(result).toHaveLength(5)
  })

  test('handles name appearing multiple times', () => {
    const result = highlightEntityNames('Bolt attacked Bolt', registry)
    // "Bolt" (pilot), " attacked " (text), "Bolt" (pilot)
    expect(result).toHaveLength(3)
  })

  test('returns plain text for empty registry', () => {
    const result = highlightEntityNames('Some text', [])
    expect(result).toEqual(['Some text'])
  })

  test('returns plain text for empty description', () => {
    const result = highlightEntityNames('', registry)
    expect(result).toEqual([''])
  })

  test('case-insensitive matching preserves original casing', () => {
    const result = highlightEntityNames('atlas SP updated', registry)
    // Should match "atlas" even though registry has "Atlas"
    expect(result).toHaveLength(2)
    // The matched span should use the original text casing
    const span = result[0] as { props: { children: string } }
    expect(span.props.children).toBe('atlas')
  })

  test('longer names matched before shorter substrings', () => {
    const reg: NameRegistry = [
      { name: 'Iron Mongrel Mark II', color: 'mech' },
      { name: 'Iron Mongrel', color: 'mech' },
    ]
    const result = highlightEntityNames('Iron Mongrel Mark II deployed', reg)
    // Should match "Iron Mongrel Mark II" as one span, not split into parts
    expect(result).toHaveLength(2)
    const span = result[0] as { props: { children: string } }
    expect(span.props.children).toBe('Iron Mongrel Mark II')
  })
})
