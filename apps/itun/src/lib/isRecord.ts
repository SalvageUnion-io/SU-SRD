/**
 * Narrow an unknown JSON/IndexedDB value to a keyed record. Note: arrays are
 * `typeof 'object'` too, so callers that must exclude them pair this with
 * `!Array.isArray(...)` (matching the historical inline checks this guard
 * replaces).
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
