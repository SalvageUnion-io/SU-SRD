/**
 * Environment variable validation and helpers
 * Provides validated access to environment variables with helpful error messages
 */

import { logger } from './logger'

const requiredEnvVars = {
  VITE_SUPABASE_URL: {
    name: 'VITE_SUPABASE_URL',
    description: 'Supabase project URL',
    example: 'https://your-project.supabase.co',
  },
  VITE_SUPABASE_ANON_KEY: {
    name: 'VITE_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous key',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
} as const

/**
 * Get environment variable with validation
 * @param key - Environment variable key
 * @param required - Whether the variable is required (default: true)
 * @returns Environment variable value
 * @throws Error if required variable is missing
 */
function getEnvVar(key: string, required = true): string | undefined {
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
  const value = isTest ? process.env[key] : import.meta.env[key]

  if (required && !value) {
    const varInfo = requiredEnvVars[key as keyof typeof requiredEnvVars]
    const errorMessage = varInfo
      ? `Missing required environment variable: ${varInfo.name}\n` +
        `Description: ${varInfo.description}\n` +
        `Example: ${varInfo.example}\n` +
        `See .env.example for more information.`
      : `Missing required environment variable: ${key}`

    throw new Error(errorMessage)
  }

  return value
}

/**
 * Get optional environment variable
 * @param key - Environment variable key
 * @returns Environment variable value or undefined
 */
function getOptionalEnvVar(key: string): string | undefined {
  return getEnvVar(key, false)
}

/**
 * Validated Supabase URL
 * @throws Error if VITE_SUPABASE_URL is missing
 */
export function getSupabaseUrl(): string {
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
  const url = getEnvVar('VITE_SUPABASE_URL', !isTest)

  // In test environments, provide default mock value if not set
  if (isTest && !url) {
    return 'https://test.supabase.co'
  }

  return url!
}

/**
 * Validated Supabase anonymous key
 * @throws Error if VITE_SUPABASE_ANON_KEY is missing
 */
export function getSupabaseAnonKey(): string {
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
  const key = getEnvVar('VITE_SUPABASE_ANON_KEY', !isTest)

  // In test environments, provide default mock value if not set
  if (isTest && !key) {
    return 'test-anon-key'
  }

  return key!
}

/**
 * Optional site URL
 */
export function getSiteUrl(): string | undefined {
  return getOptionalEnvVar('VITE_SITE_URL')
}

/**
 * Optional Discord sign-in enabled flag
 */
export function getShowDiscordSignIn(): boolean {
  const value = getOptionalEnvVar('VITE_SHOW_DISCORD_SIGNIN')
  return value === 'true'
}

/**
 * Optional Google Analytics measurement ID
 */
export function getGaMeasurementId(): string | undefined {
  return getOptionalEnvVar('VITE_GA_MEASUREMENT_ID')
}

/**
 * Validate all required environment variables on module load
 * This helps catch configuration errors early
 */
export function validateEnvVars(): void {
  try {
    getSupabaseUrl()
    getSupabaseAnonKey()
  } catch (error) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      logger.error('Environment variable validation failed:', error)
      throw error
    }
  }
}
