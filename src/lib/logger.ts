/**
 * Centralized logging utility
 * Provides environment-aware logging that respects dev/prod modes
 */

const isDev = import.meta.env.DEV

/**
 * Logger utility with environment-aware methods
 * - log, warn, debug: Only in development
 * - error: Always logged (even in production)
 */
export const logger = {
  /**
   * Log informational messages (dev only)
   */
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args)
    }
  },

  /**
   * Log error messages (always logged)
   */
  error: (...args: unknown[]) => {
    console.error(...args)
  },

  /**
   * Log warning messages (dev only)
   */
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args)
    }
  },

  /**
   * Log debug messages (dev only)
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args)
    }
  },
}
