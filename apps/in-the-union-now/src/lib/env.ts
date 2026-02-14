import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_SITE_URL: z.string().url().optional(),
})

type Env = z.infer<typeof envSchema>

function isTestEnv(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
}

function getRawEnv(): Record<string, string | undefined> {
  if (isTestEnv()) {
    return {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
      VITE_SITE_URL: process.env.VITE_SITE_URL,
    }
  }

  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SITE_URL: import.meta.env.VITE_SITE_URL,
  }
}

const testFallbacks: Env = {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
}

let _env: Env | null = null

function getEnv(): Env {
  if (_env) return _env

  const raw = getRawEnv()

  if (isTestEnv()) {
    // In test: use real values if available, otherwise fall back
    _env = {
      VITE_SUPABASE_URL: raw.VITE_SUPABASE_URL || testFallbacks.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: raw.VITE_SUPABASE_ANON_KEY || testFallbacks.VITE_SUPABASE_ANON_KEY,
      VITE_SITE_URL: raw.VITE_SITE_URL,
    }
    return _env
  }

  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(
      `Missing or invalid environment variables:\n${issues}\nSee .env.example for more information.`
    )
  }

  _env = result.data
  return _env
}

export function getSupabaseUrl(): string {
  return getEnv().VITE_SUPABASE_URL
}

export function getSupabaseAnonKey(): string {
  return getEnv().VITE_SUPABASE_ANON_KEY
}

export function getSiteUrl(): string | undefined {
  return getEnv().VITE_SITE_URL
}

export function validateEnvVars(): void {
  getEnv()
}
