// Wave 0 scaffold smoke test.
// Verifies the schema and store modules export their placeholder symbols.
// Real tests for features ship in Wave 1 (M1 stories).
import { describe, expect, it } from 'bun:test'
import { placeholderSchema } from '../src/lib/schemas/index'
import { useAppStore } from '../src/stores/index'

describe('Wave 0 scaffold', () => {
  it('exports placeholderSchema', () => {
    const result = placeholderSchema.safeParse({ id: 'test' })
    expect(result.success).toBe(true)
  })

  it('exports useAppStore with initial state', () => {
    const state = useAppStore.getState()
    expect(state.initialized).toBe(false)
  })
})
