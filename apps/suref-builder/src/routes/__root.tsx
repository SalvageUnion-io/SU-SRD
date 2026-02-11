import { useEffect, useState } from 'react'
import { createRootRoute, Outlet, Scripts, HeadContent } from '@tanstack/react-router'
import { Box, Flex, ChakraProvider } from '@chakra-ui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { TopNavigation } from '../components/TopNavigation'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { GlobalLoadingBar } from '../components/shared/GlobalLoadingBar'
import { NotFoundDisplay } from '../components/shared/NotFoundDisplay'
import Footer from '../components/Footer'
import { getSession, onAuthStateChange } from '../lib/api'
import type { User } from '@supabase/supabase-js'
import { Toaster, EntityDisplayModal, system } from '../chakra'
import { useEntityViewerStore } from '../stores/entityViewerStore'
import { ThemeProvider } from '../providers/ThemeProvider'
import { fetchCurrentUser } from '../lib/supabase.server'
import { queryClient } from '../lib/queryClient'
import type React from 'react'
import { initPerformanceMonitoring } from '../lib/performance'

/**
 * Global entity viewer modal connected to Zustand store.
 * Renders the modal without needing a Context provider.
 */
function GlobalEntityModal() {
  const { isOpen, schemaName, entityId, closeEntityModal } = useEntityViewerStore()
  return (
    <EntityDisplayModal
      isOpen={isOpen}
      onClose={closeEntityModal}
      schemaName={schemaName}
      entityId={entityId}
    />
  )
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  beforeLoad: async () => {
    const serverUser = await fetchCurrentUser()
    return {
      serverUser,
    }
  },
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ChakraProvider value={system}>{children}</ChakraProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(true)

  useEffect(() => {
    getSession().then((session) => {
      setUser(session?.user ?? null)
      setUserLoading(false)
    })

    const subscription = onAuthStateChange((authUser) => {
      setUser(authUser)
      setUserLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Initialize performance monitoring
  useEffect(() => {
    initPerformanceMonitoring()
  }, [])

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Salvage Union Builder</title>
        {/* Initialize theme immediately to prevent flash - explicitly set to light mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('chakra-ui-color-mode', 'light');
              })();
            `,
          }}
        />
        {/* Resource hints for faster external resource loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="dns-prefetch" href="https://*.supabase.co" />
        <link rel="dns-prefetch" href="https://*.supabase.in" />
        {/* Preload critical font */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap"
          as="style"
        />
        {/* Content Security Policy - includes localhost for local development */}
        {/* Note: CSP in meta tag applies to local dev; Netlify headers override in production */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost http://127.0.0.1 https://*.supabase.co https://*.netlify.app;"
        />
        <HeadContent />
      </head>
      <body>
        <Providers>
          <ErrorBoundary>
            <GlobalLoadingBar />
            <Flex flexDirection="column" h="100vh" bg="bg.canvas">
              <TopNavigation user={user} userLoading={userLoading} />
              <Box as="main" flex="1" display="flex" bg="bg.landing" flexDirection="column">
                {children}
              </Box>
              <Footer />
            </Flex>
            <Toaster />
            <GlobalEntityModal />
          </ErrorBoundary>
        </Providers>
        <Scripts />
      </body>
    </html>
  )
}

function NotFoundComponent() {
  return <NotFoundDisplay />
}
