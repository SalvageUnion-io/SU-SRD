import { describe, test, expect } from 'bun:test'
import { getEntitySlug, nameToSlug } from '../slug'

describe('slug utilities', () => {
  test('nameToSlug converts name to lowercase kebab-case', () => {
    expect(nameToSlug('Heavy Laser')).toBe('heavy-laser')
    expect(nameToSlug('Atlas Mk II')).toBe('atlas-mk-ii')
  })

  test('nameToSlug handles single word', () => {
    expect(nameToSlug('Shield')).toBe('shield')
  })

  test('getEntitySlug generates slug from entity id and name', () => {
    const slug = getEntitySlug({ id: 'abc-123', name: 'Heavy Laser' } as Parameters<
      typeof getEntitySlug
    >[0])
    expect(slug).toContain('heavy-laser')
  })

  test('re-exports are defined', () => {
    expect(typeof nameToSlug).toBe('function')
    expect(typeof getEntitySlug).toBe('function')
  })
})
