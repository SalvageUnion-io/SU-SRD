type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'CONFLICT'
  | 'UNKNOWN'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly status: number

  constructor(code: AppErrorCode, message: string, status = 500) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

/**
 * Maps Supabase/PostgREST errors to structured AppError.
 * Throws immediately so callers use: `if (error) handleSupabaseError(error)`
 */
export function handleSupabaseError(error: { code?: string; message: string }): never {
  const code = error.code ?? ''

  // PostgREST error codes
  if (code === 'PGRST116') {
    throw new AppError('NOT_FOUND', error.message, 404)
  }
  if (code === '42501') {
    throw new AppError('PERMISSION_DENIED', error.message, 403)
  }
  if (code === '23505') {
    throw new AppError('CONFLICT', error.message, 409)
  }
  if (code === '23503') {
    throw new AppError('VALIDATION_ERROR', error.message, 400)
  }
  if (code === '23514') {
    throw new AppError('VALIDATION_ERROR', error.message, 400)
  }

  // Auth errors
  if (code === 'invalid_credentials' || code === 'user_not_found') {
    throw new AppError('AUTH_REQUIRED', error.message, 401)
  }

  throw new AppError('UNKNOWN', error.message)
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}
