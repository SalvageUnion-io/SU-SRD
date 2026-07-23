/**
 * Test-only unwrap for fixture lookups: returns the value, failing the test
 * with a clear error when the lookup came back null/undefined — replaces
 * non-null assertions (`!`) so a missing fixture surfaces as a thrown message
 * instead of an undefined-property crash.
 */
export function must<T>(value: T | null | undefined, label = 'value'): T {
  if (value == null) throw new Error(`Expected ${label} to be present`)
  return value
}
