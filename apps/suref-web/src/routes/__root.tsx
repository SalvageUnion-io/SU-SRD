import { createRootRoute, Outlet, Scripts, HeadContent } from '@tanstack/react-router'
import { Box, Flex, ChakraProvider } from '@chakra-ui/react'
import { TopNavigation } from '../components/TopNavigation'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { GlobalLoadingBar } from '../components/shared/GlobalLoadingBar'
import { NotFoundDisplay } from '../components/shared/NotFoundDisplay'
import Footer from '../components/Footer'
import { getSchemaCatalog } from 'salvageunion-reference'
import { Toaster } from 'suref-react'
import { EntityDisplayModal } from 'suref-react'
import { useEntityViewerStore } from '../stores/entityViewerStore'
import { ThemeProvider } from '../providers/ThemeProvider'
import { system } from 'suref-react'
import type React from 'react'

const schemaIndexData = getSchemaCatalog()

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
    <ThemeProvider>
      <ChakraProvider value={system}>{children}</ChakraProvider>
    </ThemeProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Salvage Union System Reference Document</title>
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
        {/* Preload critical font */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap"
          as="style"
        />
        <HeadContent />
      </head>
      <body>
        <Providers>
          <ErrorBoundary>
            <GlobalLoadingBar />
            <Flex flexDirection="column" h="100vh" bg="bg.canvas">
              <TopNavigation schemas={schemaIndexData.schemas.filter((s) => !s.meta)} />
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
