import type { GlobalProvider } from '@ladle/react'
import '../src/shadcn/styles/ladle.css'

export const Provider: GlobalProvider = ({ children }) => (
  <div style={{ padding: '1rem', fontFamily: 'Fira Code, monospace' }}>{children}</div>
)
