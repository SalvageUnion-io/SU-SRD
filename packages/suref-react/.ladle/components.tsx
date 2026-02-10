import type { GlobalProvider } from '@ladle/react'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../src/theme'

export const Provider: GlobalProvider = ({ children }) => (
  <ChakraProvider value={system}>
    <div style={{ padding: '1rem', fontFamily: 'Fira Code, monospace' }}>{children}</div>
  </ChakraProvider>
)
