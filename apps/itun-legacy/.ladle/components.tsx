import type { GlobalProvider } from '@ladle/react'
import '../src/index.css'

export const Provider: GlobalProvider = ({ children }) => (
  <div className="min-h-screen bg-[var(--background)] p-4 font-mono text-[var(--foreground)]">
    {children}
  </div>
)
