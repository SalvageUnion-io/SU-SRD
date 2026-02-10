import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps as NextThemesProviderProps } from 'next-themes'
import type { ReactNode } from 'react'

interface ThemeProviderProps extends Omit<NextThemesProviderProps, 'children'> {
  children: ReactNode
}

/**
 * Theme provider using next-themes for Chakra UI v3 color mode support
 * Explicitly forces light mode
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      forcedTheme="light"
      enableSystem={false}
      storageKey="chakra-ui-color-mode"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
