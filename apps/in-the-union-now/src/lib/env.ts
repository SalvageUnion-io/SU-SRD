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

export function getSupabaseUrl(): string {
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
  const url = getEnvVar('VITE_SUPABASE_URL', !isTest)

  if (isTest && !url) {
    return 'https://test.supabase.co'
  }

  return url!
}

export function getSupabaseAnonKey(): string {
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
  const key = getEnvVar('VITE_SUPABASE_ANON_KEY', !isTest)

  if (isTest && !key) {
    return 'test-anon-key'
  }

  return key!
}

export function getSiteUrl(): string | undefined {
  return getEnvVar('VITE_SITE_URL', false)
}

export function validateEnvVars(): void {
  try {
    getSupabaseUrl()
    getSupabaseAnonKey()
  } catch (error) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      console.error('Environment variable validation failed:', error)
      throw error
    }
  }
}
