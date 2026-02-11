import { GlobalRegistrator } from '@happy-dom/global-registrator'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

GlobalRegistrator.register()

process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
