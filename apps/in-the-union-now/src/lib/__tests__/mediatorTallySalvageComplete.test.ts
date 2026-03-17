import { describe, expect, test } from 'bun:test'

// Pure helper extracted from MediatorDowntimeGuide's tallySalvageComplete computation.
// Import from the production location once implemented.
import { computeMediatorTallySalvageComplete } from '../mediatorDowntimeUtils'
import type { OffloadReceipt } from '../tallySalvageUtils'

type Pilot = { id: string }

function makeReceipt(): OffloadReceipt {
  return { scrapByTL: {}, storageCount: 0 }
}

describe('computeMediatorTallySalvageComplete', () => {
  test('returns false when isLoading is true, even if all pilots have receipts', () => {
    const pilots: Pilot[] = [{ id: 'p1' }]
    const receipts: Record<string, OffloadReceipt> = { p1: makeReceipt() }
    expect(computeMediatorTallySalvageComplete(true, pilots, receipts)).toBe(false)
  })

  test('returns false when pilots array is empty', () => {
    expect(computeMediatorTallySalvageComplete(false, [], {})).toBe(false)
  })

  test('returns false when pilots is undefined/null', () => {
    expect(computeMediatorTallySalvageComplete(false, undefined, {})).toBe(false)
    expect(computeMediatorTallySalvageComplete(false, null, {})).toBe(false)
  })

  test('returns false when offloadReceipts is null/undefined', () => {
    const pilots: Pilot[] = [{ id: 'p1' }]
    expect(computeMediatorTallySalvageComplete(false, pilots, null)).toBe(false)
    expect(computeMediatorTallySalvageComplete(false, pilots, undefined)).toBe(false)
  })

  test('returns false when some pilots are missing from receipts', () => {
    const pilots: Pilot[] = [{ id: 'p1' }, { id: 'p2' }]
    const receipts: Record<string, OffloadReceipt> = { p1: makeReceipt() }
    expect(computeMediatorTallySalvageComplete(false, pilots, receipts)).toBe(false)
  })

  test('returns true when every pilot has an offload receipt', () => {
    const pilots: Pilot[] = [{ id: 'p1' }, { id: 'p2' }]
    const receipts: Record<string, OffloadReceipt> = {
      p1: makeReceipt(),
      p2: makeReceipt(),
    }
    expect(computeMediatorTallySalvageComplete(false, pilots, receipts)).toBe(true)
  })

  test('returns true for single pilot with receipt', () => {
    const pilots: Pilot[] = [{ id: 'p1' }]
    const receipts: Record<string, OffloadReceipt> = { p1: makeReceipt() }
    expect(computeMediatorTallySalvageComplete(false, pilots, receipts)).toBe(true)
  })
})
