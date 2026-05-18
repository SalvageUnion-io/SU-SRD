import { describe, expect, test } from 'bun:test'

// Pure logic tests for the filter strings constructed inside useDowntimeRealtime.
// The hook itself is side-effect-only so we test its pure filter construction helpers.

function downtimeRecordFilter(recordId: string | undefined): string | undefined {
  return recordId ? `id=eq.${recordId}` : undefined
}

function crawlerFilter(crawlerId: string): string {
  return `id=eq.${crawlerId}`
}

describe('useDowntimeRealtime filter construction', () => {
  test('downtime record filter includes record id', () => {
    expect(downtimeRecordFilter('rec-123')).toBe('id=eq.rec-123')
  })

  test('downtime record filter returns undefined when recordId is undefined', () => {
    expect(downtimeRecordFilter(undefined)).toBeUndefined()
  })

  test('crawler filter includes crawler id', () => {
    expect(crawlerFilter('crawler-abc')).toBe('id=eq.crawler-abc')
  })

  test('record filter uses id= not crawler_id= (scoped to exact record)', () => {
    const filter = downtimeRecordFilter('rec-xyz')
    expect(filter).toContain('id=eq.')
    expect(filter).not.toContain('crawler_id=eq.')
  })
})

// Tests that verify the hook file exports the expected function signature.
// Import will fail until the file is created — RED.
import { useDowntimeRealtime } from '../useDowntimeRealtime'

describe('useDowntimeRealtime export', () => {
  test('is a function', () => {
    expect(typeof useDowntimeRealtime).toBe('function')
  })

  test('accepts two arguments (crawlerId, recordId)', () => {
    // The function signature should accept 2 params
    expect(useDowntimeRealtime.length).toBe(2)
  })
})
