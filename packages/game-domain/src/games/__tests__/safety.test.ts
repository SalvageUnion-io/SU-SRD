import { describe, expect, test } from 'bun:test'
import { BOUNDARY_TEXT_MAX, boundaryRefusal, normalizeBoundary } from '../safety'

describe('a boundary’s words', () => {
  test('are trimmed, inner space collapsed', () => {
    expect(normalizeBoundary('  Graphic \n  torture ')).toBe('Graphic torture')
  })

  test('are refused empty or over the cap, after normalising', () => {
    expect(boundaryRefusal(' \t ')).toBe('A boundary needs some words.')
    expect(boundaryRefusal('x'.repeat(BOUNDARY_TEXT_MAX + 1))).toContain('at most')
    expect(boundaryRefusal(`${'x'.repeat(BOUNDARY_TEXT_MAX)}   `)).toBeNull()
  })
})
