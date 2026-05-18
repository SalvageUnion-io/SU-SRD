import type { ZodType } from 'zod'

/**
 * Thrown when a Supabase result fails Zod validation at the API boundary.
 *
 * Prefer catching this in callers to distinguish schema-drift failures from
 * network / permission errors surfaced via `AppError`.
 */
export class DatabaseParseError extends Error {
  readonly context: string | undefined
  readonly issues: unknown

  constructor(message: string, options?: { context?: string; issues?: unknown; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'DatabaseParseError'
    this.context = options?.context
    this.issues = options?.issues
  }
}

function formatMessage(context: string | undefined, detail: string): string {
  return context ? `[${context}] ${detail}` : detail
}

/**
 * Parse a single Supabase result row through a Zod schema.
 *
 * Use this at the API boundary (in `src/lib/api/*.ts`) instead of
 * `as unknown as T`. A mismatched DB shape will throw a `DatabaseParseError`
 * with the originating context, rather than silently propagating malformed
 * data into TanStack Query caches and UI.
 *
 * @param data Raw data from `supabase.from(...).single()` or `supabase.rpc(...)`
 * @param schema Zod schema describing the expected row shape
 * @param context Optional label (e.g. `'createGame'`) used in error messages
 */
export function parseDatabaseResult<T>(data: unknown, schema: ZodType<T>, context?: string): T {
  if (data === null || data === undefined) {
    throw new DatabaseParseError(
      formatMessage(context, 'Expected database row but received null/undefined'),
      { context }
    )
  }

  const result = schema.safeParse(data)
  if (!result.success) {
    throw new DatabaseParseError(
      formatMessage(context, `Database row failed schema validation: ${result.error.message}`),
      { context, issues: result.error.issues, cause: result.error }
    )
  }
  return result.data
}

/**
 * Parse an array of Supabase result rows through a Zod schema.
 *
 * Accepts `null` and treats it as an empty array — this matches the common
 * Supabase pattern where list queries return `data ?? []`.
 */
export function parseDatabaseResultArray<T>(
  data: unknown,
  schema: ZodType<T>,
  context?: string
): T[] {
  if (data === null || data === undefined) {
    return []
  }

  if (!Array.isArray(data)) {
    throw new DatabaseParseError(
      formatMessage(context, `Expected array of database rows but received ${typeof data}`),
      { context }
    )
  }

  return data.map((row, index) => {
    const result = schema.safeParse(row)
    if (!result.success) {
      throw new DatabaseParseError(
        formatMessage(
          context,
          `Database row at index ${index} failed schema validation: ${result.error.message}`
        ),
        { context, issues: result.error.issues, cause: result.error }
      )
    }
    return result.data
  })
}
