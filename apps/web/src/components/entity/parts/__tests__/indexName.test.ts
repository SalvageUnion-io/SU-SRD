import { describe, expect, test } from 'bun:test'
import { INDEX_NAME } from '../indexName'

describe('INDEX_NAME (R56)', () => {
  test('an index name is never cut: it wraps, and takes no ellipsis', () => {
    expect(INDEX_NAME).not.toHaveProperty('textOverflow')
    expect(INDEX_NAME).not.toHaveProperty('whiteSpace')
    expect(INDEX_NAME).not.toHaveProperty('overflow')
    expect(INDEX_NAME.overflowWrap).toBe('break-word')
  })
})
